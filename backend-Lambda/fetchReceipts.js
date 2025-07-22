import{ DynamoDBClient } from "@aws-sdk/client-dynamodb";
import{ DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const params = {
      TableName: "ReceiptsTable",
    };
    const data = await ddbDocClient.send(new ScanCommand(params));
    console.log(data);

    return {
      statusCode: 200,
      body: JSON.stringify(data.Items),
    };
  } catch (err) {
      console.log("Error", err);
  }
};
