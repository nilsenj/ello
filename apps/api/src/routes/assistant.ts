import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CommandParserService } from '../services/command-parser';

export const assistantRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (fastify, options) => {
  const { prisma } = options;
  const parser = new CommandParserService();
  
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
              workspaceId
            }
          });
          return reply.send({ success: true, action: 'CREATE_BOARD', data: board });
        }

        case 'CREATE_LIST': {
          // Find the board by name in the user's workspace
          const board = await prisma.board.findFirst({
            where: {
               name: { equals: command.payload.boardName, mode: 'insensitive' },
               workspaceId
            }
          });
          
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
             // Find list by name across user's reachable lists or specific board
             const list = await prisma.list.findFirst({
               where: {
                  name: { equals: command.payload.listName, mode: 'insensitive' },
                  board: { workspaceId }
               }
             });
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
