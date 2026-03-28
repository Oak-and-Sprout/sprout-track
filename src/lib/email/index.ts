import prisma from '@/app/api/db';
import { sendWithSendGrid } from './sendgrid';
import { sendWithSmtp2goApi } from './smtp2go';
import { sendWithSmtp } from './smtp';
import { SendEmailProps } from './types';
import { decrypt, isEncrypted } from '@/app/api/utils/encryption';

export const sendEmail = async (props: SendEmailProps) => {
  const emailConfig = await prisma.emailConfig.findFirst();

  if (!emailConfig) {
    console.error('Error: Email configuration not found in the database.');
    return { success: false, error: 'Email configuration not found.' };
  }

  switch (emailConfig.providerType) {
    case 'SENDGRID':
      if (!emailConfig.sendGridApiKey) {
        return { success: false, error: 'SendGrid API key is not configured.' };
      }
      const decryptedSendGridKey = isEncrypted(emailConfig.sendGridApiKey) ? decrypt(emailConfig.sendGridApiKey) : emailConfig.sendGridApiKey;
      return sendWithSendGrid(props, decryptedSendGridKey);
    
    case 'SMTP2GO':
      if (!emailConfig.smtp2goApiKey) {
        return { success: false, error: 'SMTP2GO API key is not configured.' };
      }
      const decryptedSmtp2goKey = isEncrypted(emailConfig.smtp2goApiKey) ? decrypt(emailConfig.smtp2goApiKey) : emailConfig.smtp2goApiKey;
      return sendWithSmtp2goApi(props, decryptedSmtp2goKey);

    case 'MANUAL_SFTP':
      if (!emailConfig.serverAddress || !emailConfig.port || !emailConfig.username || !emailConfig.password) {
        return { success: false, error: 'Manual SMTP settings are incomplete.' };
      }
      const decryptedPassword = isEncrypted(emailConfig.password) ? decrypt(emailConfig.password) : emailConfig.password;
      return sendWithSmtp({
        ...props,
        host: emailConfig.serverAddress,
        port: emailConfig.port,
        secure: emailConfig.enableTls,
        auth: {
          user: emailConfig.username,
          pass: decryptedPassword,
        },
        tls: {
          rejectUnauthorized: !emailConfig.allowSelfSignedCert,
        },
      });

    default:
      console.error(`Error: Unsupported email provider type: ${emailConfig.providerType}`);
      return { success: false, error: 'Unsupported email provider.' };
  }
}; 