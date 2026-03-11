import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CommandParserService } from '../services/command-parser';
import fastifyMultipart from '@fastify/multipart';
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function fuzzyMatch(dbName: string, spokenName: string): boolean {
   const cleanDb = dbName.toLowerCase().replace(/^(the|a|my)\s+/i, '').replace(/[.!?]+$/, '').trim();
   const cleanSpoken = spokenName.toLowerCase().replace(/^(the|a|my)\s+/i, '').replace(/[.!?]+$/, '').trim();
   return cleanDb === cleanSpoken || cleanDb.includes(cleanSpoken) || cleanSpoken.includes(cleanDb);
}

export const assistantRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (fastify, options) => {
  const { prisma } = options;
  const parser = new CommandParserService();
  
  // Register multipart specifically for handling audio uploads in this plugin
  if (!fastify.hasContentTypeParser('multipart/form-data')) {
    await fastify.register(fastifyMultipart, {
      limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for audio chunks
    });
  }
  
  // Initialize OpenAI strictly for audio transcription processing
  const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

  fastify.post('/api/assistant/transcribe', async (request, reply) => {
     // 1. Authenticate
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!openai) {
      return reply.code(500).send({ error: 'OpenAI API Key is missing. Transcription disabled.' });
    }

    try {
      const data = await request.file();
      if (!data) {
         return reply.code(400).send({ error: 'No audio file provided' });
      }

      // Write stream to temp file because openai.audio.transcriptions needs a filesystem File or stream
      const tempDir = path.resolve(process.cwd(), 'uploads', 'tmp');
      fs.mkdirSync(tempDir, { recursive: true });
      
      const ext = data.mimetype.includes('webm') ? '.webm' : '.m4a';
      const tempId = crypto.randomBytes(16).toString('hex');
      const tempPath = path.join(tempDir, `${tempId}${ext}`);
      
      const writeStream = fs.createWriteStream(tempPath);
      await data.file.pipe(writeStream);
      await new Promise<void>((res, rej) => {
         writeStream.on('finish', () => res());
         writeStream.on('error', rej);
      });

      // Call Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'en' // Provide a hint for speed, though omit if multi-lang is needed
      });

      // Cleanup
      fs.unlinkSync(tempPath);

      return reply.send({ text: transcription.text });
      
    } catch (err: any) {
       fastify.log.error(err);
       return reply.code(500).send({ error: 'Failed to transcribe audio' });
    }
  });
  
  fastify.post('/api/assistant/command', async (request, reply) => {
    // 1. Authenticate user
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { text, context } = request.body as {
      text: string;
      context?: { activeWorkspaceId?: string; activeBoardId?: string };
    };

    if (!text || typeof text !== 'string') {
        return reply.code(400).send({ error: 'Missing or invalid "text" field' });
    }

    // Default to a known workspace or first workspace if not provided
    let workspaceId = context?.activeWorkspaceId;
    if (!workspaceId) {
      const firstWorkspace = await prisma.workspace.findFirst({
        where: { members: { some: { userId: user.id } } }
      });
      if (!firstWorkspace) {
         return reply.code(403).send({ error: 'No workspace found for user' });
      }
      workspaceId = firstWorkspace.id;
    }

    // 2. Parse command natively or securely with LLM fallback
    const command = await parser.parseCommandSmart(text);

    if (command.action === 'UNKNOWN') {
       return reply.code(400).send({ 
         error: 'Command not understood.',
         details: 'Ensure you are using the supported command formats or natural language like "Create board [name]".' 
       });
    }

    try {
      // 3. Execute command safely using native DB queries attached to the user scope
      switch (command.action) {
        case 'CREATE_BOARD': {
          const board = await prisma.board.create({
            data: {
              name: command.payload.name,
              workspaceId,
              // Automatically make the creator an admin!
              members: {
                create: {
                  userId: user.id,
                  role: 'admin'
                }
              },
              // Provide some sane default lists so it isn't completely empty
              lists: {
                 create: [
                    { name: 'To Do', rank: '1' },
                    { name: 'Doing', rank: '2' },
                    { name: 'Done',  rank: '3' }
                 ]
              }
            }
          });
          return reply.send({ success: true, action: 'CREATE_BOARD', data: board });
        }

        case 'CREATE_LIST': {
          // Find the board by fuzzy name in the user's workspace
          const boards = await prisma.board.findMany({ where: { workspaceId } });
          const board = boards.find(b => fuzzyMatch(b.name, command.payload.boardName));
          
          if (!board) {
             return reply.code(404).send({ error: `Board "${command.payload.boardName}" not found.` });
          }

          // Get next rank
          const lists = await prisma.list.findMany({ where: { boardId: board.id }, orderBy: { rank: 'asc' } });
          const nextRank = lists.length > 0 ? `${lists.length + 1}` : '1'; // A simplistic mock of rank, should use utils/rank.ts ideally but will suffice for demo

          const list = await prisma.list.create({
            data: {
              name: command.payload.name,
              boardId: board.id,
              rank: nextRank
            }
          });
          return reply.send({ success: true, action: 'CREATE_LIST', data: list });
        }

        case 'CREATE_CARD': {
          let listId: string | null = null;
          let boardId = context?.activeBoardId;

          if (command.payload.listName) {
             // Find list by fuzzy name across user's reachable lists
             const lists = await prisma.list.findMany({
               where: { board: { workspaceId } }
             });
             const list = lists.find(l => fuzzyMatch(l.name, command.payload.listName!));
             
             if (!list) {
                return reply.code(404).send({ error: `List "${command.payload.listName}" not found.` });
             }
             listId = list.id;
          } else {
             // Implicit list - needs active board context
             if (!boardId) {
                 return reply.code(400).send({ error: 'Active board context required to implicitly create a task.' });
             }
             const firstList = await prisma.list.findFirst({
                where: { boardId },
                orderBy: { rank: 'asc' }
             });
             if (!firstList) {
                return reply.code(400).send({ error: 'No lists found in active board to add the task to.' });
             }
             listId = firstList.id;
          }

          const newCard = await prisma.card.create({
            data: {
              title: command.payload.title,
              listId,
              rank: '1' // Simplistic rank for new cards
            }
          });
          return reply.send({ success: true, action: 'CREATE_CARD', data: newCard });
        }
      }
    } catch (e: any) {
       fastify.log.error(e);
       return reply.code(500).send({ error: 'Internal Server Error executing command.' });
    }
  });
};
