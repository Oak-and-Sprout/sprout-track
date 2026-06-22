/* eslint-disable no-console */
import * as readline from 'readline';
import { sendEmail } from '../src/lib/email';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function runTest() {
  try {
    const to = await askQuestion('Enter recipient email: ');
    const from = await askQuestion('Enter sender email (must be a verified SendGrid sender): ');

    rl.close();

    console.log(`Sending email to: ${to} from: ${from}…`);

    const result = await sendEmail({
      to,
      from,
      subject: 'Sprout-track email test with SendGrid',
      text: 'This validates that sendgrid is working with sprout-track',
      html: '<strong>This validates that sendgrid is working with sprout-track</strong>',
    });

    if (result.success) {
      console.log('✅ Email sent successfully!');
    } else {
      console.error('❌ Failed to send email:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
}

runTest(); 