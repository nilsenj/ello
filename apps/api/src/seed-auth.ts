// apps/api/src/seed-auth.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

    // Demo users
    const users = [
        {
            email: 'admin@ello.dev',
            name: 'Admin',
            password: 'admin123', // dev only
            role: 'owner' as const,
        },
        {
            email: 'user@ello.dev',
            name: 'Demo User',
            password: 'user123',  // dev only
            role: 'member' as const,
        },
    ];

    for (const u of users) {
        const hash = await bcrypt.hash(u.password, rounds);

        // upsert user
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { name: u.name, password: hash },
            create: { email: u.email, name: u.name, password: hash },
        });

        // Optionally: ensure they belong to the demo workspace/board later in seed.ts
        // (We usually link via BoardMember in the main demo seed.)

        // Optionally: create a long-lived refresh token for dev convenience
        // (In real app, you only issue after /auth/login)
        const refreshToken = `dev-${user.id}-${Date.now()}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // +30d

        await prisma.refreshToken.upsert({
            where: { token: refreshToken },
            update: { expiresAt },
            create: { token: refreshToken, userId: user.id, expiresAt },
        });

        console.log(`Seeded user: ${u.email} (pw: ${u.password})`);
    }
}

main()
    .then(async () => {
        console.log('Auth seed done.');
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
