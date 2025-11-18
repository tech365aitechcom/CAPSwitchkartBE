import awsServerlessExpress from 'aws-serverless-express';
import server from './server.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create the server
const awsServer = awsServerlessExpress.createServer(server);

// Export the handler function
export const handler = (event, context) => {
  awsServerlessExpress.proxy(awsServer, event, context);
};
