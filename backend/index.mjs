import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import twilio from "twilio";

// Set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// DynamoDB Configuration Settings.
const REGION = "us-east-1"; // Replace with your region
const TABLE_NAME = "BlackhawksCfa"; // Replace with your table name

// Create a DynamoDB Document Client here.
const dynamoDbClient = new DynamoDBClient({ region: REGION });
const dynamoDb = DynamoDBDocumentClient.from(dynamoDbClient);

export const handler = async (event) => {
  try {
    // Log the incoming event for debugging purposes mostly.
    console.log("Event received:", JSON.stringify(event));

    // Parse and validate the request body.
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing request body" }),
      };
    }

    let body;
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (error) {
      console.error("Invalid JSON in body:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid JSON format in request body" }),
      };
    }

    const { name, phone, action } = body;
    console.log("action is " + action);
    // Validate input fields - name and phone are Pk/Sk.
    if (!name || !phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Both 'name' and 'phone' are required fields" }),
      };
    }

    if (action === "Add My Number") {
      const params = {
        TableName: TABLE_NAME,
        Item: { Name: name, SK: "GRP1#" + phone, Phone: phone, Blackhawks: "true" },
      };
      await dynamoDb.send(new PutCommand(params));
      await createMessage(phone, name);

    } else if (action === "Delete My Number") {
      const deleteParams = {
        TableName: TABLE_NAME,
        Key: {
          Name: name,
          SK: "GRP1#" + phone,
        },
      };
      await dynamoDb.send(new DeleteCommand(deleteParams));
      await deleteMessage(phone);

    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid action specified" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work.
        "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS.
      },
      body: JSON.stringify({ message: `${action} successful` }),
    };
  } catch (error) {
    console.error("Error inserting data:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};
/**
 * Message to send when someone subscribes.
 * @param {*} phone 
 * @param {*} personsName 
 */
async function createMessage(phone, personsName) {
  try {
    console.log("Attempting to send message to phone:", phone);
    const message = await client.messages.create({
      body: "You're in for Blackhawks Chick-fil-a breakfast alerts, " + personsName + "! Change your mind? Reply STOP to unsubscribe. Msg&Data Rates May Apply",
      from: "+15138668921",
      to: "+1" + phone,
    });
    console.log('Message sent successfully:', message.status);
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

/**
 * Message to send when someone delete's their data.
 * @param {*} phone 
 */
async function deleteMessage(phone) {
  try {
    const message = await client.messages.create({
      body: "Your data has been removed from BlackhawksCfa Alerts. Reply HELP for help. Reply STOP to unsubscribe. Msg&Data Rates May Apply",
      from: "+15138668921",
      to: "+1" + phone,

    });
    console.log('Message sent successfully:', message.status);
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

