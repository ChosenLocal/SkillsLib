import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
  dashboardUrl: string;
}

export function WelcomeEmail({ name, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Business Automation System</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to Business Automation System!</Heading>
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>
            Thank you for verifying your email address. Your account is now fully activated and ready to use!
          </Text>
          <Text style={text}>
            Business Automation System helps you automate your business processes with AI-powered agents. Here are some things you can do:
          </Text>
          <ul style={list}>
            <li style={listItem}>Generate complete websites automatically</li>
            <li style={listItem}>Create high-quality content with AI</li>
            <li style={listItem}>Build custom workflows for your business</li>
            <li style={listItem}>Collaborate with your team</li>
          </ul>
          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>
          <Text style={footer}>
            Need help getting started? Check out our documentation or contact our support team.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 8px',
};

const list = {
  margin: '16px 8px',
  padding: '0 0 0 20px',
};

const listItem = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '8px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#000',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const footer = {
  color: '#898989',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '32px 8px 0',
  textAlign: 'center' as const,
};
