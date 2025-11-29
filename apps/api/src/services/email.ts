import nodemailer from 'nodemailer';

export class EmailService {
    private static transporter: nodemailer.Transporter;

    static async initialize() {
        if (this.transporter) return;

        // For development, use Ethereal
        if (process.env.NODE_ENV !== 'production') {
            const testAccount = await nodemailer.createTestAccount();
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            console.log('[EmailService] Initialized with Ethereal Email');
        } else {
            // Configure production transport here (e.g., SendGrid, SES)
            // this.transporter = nodemailer.createTransport({...});
            console.warn('[EmailService] Production transport not configured, falling back to console log');
        }
    }

    static async sendInvitationEmail(to: string, workspaceName: string, inviterName: string) {
        if (!this.transporter) await this.initialize();

        if (!this.transporter) {
            console.log(`[EmailService] (Mock) Sending invitation to ${to} for ${workspaceName}`);
            return;
        }

        const info = await this.transporter.sendMail({
            from: '"Ello" <noreply@ello.com>',
            to,
            subject: `You've been invited to join ${workspaceName} on Ello`,
            text: `Hello,\n\n${inviterName} has invited you to join the workspace "${workspaceName}" on Ello.\n\nClick here to join: http://localhost:4200/signup?email=${encodeURIComponent(to)}\n\nBest,\nThe Ello Team`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>You've been invited!</h2>
                    <p><strong>${inviterName}</strong> has invited you to join the workspace <strong>"${workspaceName}"</strong> on Ello.</p>
                    <p>
                        <a href="http://localhost:4200/signup?email=${encodeURIComponent(to)}" 
                           style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                           Join Workspace
                        </a>
                    </p>
                    <p style="color: #666; font-size: 12px;">If you didn't expect this invitation, you can ignore this email.</p>
                </div>
            `,
        });

        console.log(`[EmailService] Message sent: ${info.messageId}`);
        console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

        return info;
    }

    static async sendMemberRemovedEmail(to: string, workspaceName: string) {
        if (!this.transporter) await this.initialize();

        if (!this.transporter) {
            console.log(`[EmailService] (Mock) Sending removal notification to ${to} for ${workspaceName}`);
            return;
        }

        const info = await this.transporter.sendMail({
            from: '"Ello" <noreply@ello.com>',
            to,
            subject: `You have been removed from ${workspaceName}`,
            text: `Hello,\n\nYou have been removed from the workspace "${workspaceName}" on Ello.\n\nBest,\nThe Ello Team`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Workspace Update</h2>
                    <p>You have been removed from the workspace <strong>"${workspaceName}"</strong> on Ello.</p>
                    <p style="color: #666; font-size: 12px;">If you believe this is an error, please contact the workspace admin.</p>
                </div>
            `,
        });

        console.log(`[EmailService] Removal email sent: ${info.messageId}`);
        console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

        return info;
    }
}
