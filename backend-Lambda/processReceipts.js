// Required AWS SDK clients
import { S3Client } from "@aws-sdk/client-s3";
import { TextractClient, AnalyzeExpenseCommand } from "@aws-sdk/client-textract";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

// Environment Variables
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'ReceiptsTable';
const SES_SENDER_EMAIL = process.env.SES_SENDER_EMAIL || 'bhaskarballa83@gmail.com';
const SES_RECIPIENT_EMAIL = process.env.SES_RECIPIENT_EMAIL || 'bhaskarballa83@gmail.com';

// AWS Clients
const s3 = new S3Client({ region: "us-east-1" });
const textract = new TextractClient({ region: "us-east-1" });
const ses = new SESClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));

export const handler = async (event) => {
  try {
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing receipt from ${bucket}/${key}`);

    const receiptData = await processReceiptWithTextract(bucket, key);
    await storeReceiptInDynamoDB(receiptData);
    await sendEmailNotification(receiptData);

    return {
      statusCode: 200,
      body: JSON.stringify('Receipt processed successfully!')
    };
  } catch (error) {
    console.error("Error processing receipt:", error);
    return {
      statusCode: 500,
      body: JSON.stringify(`Error: ${error.message}`)
    };
  }
};

async function processReceiptWithTextract(bucket, key) {
  try {
    const command = new AnalyzeExpenseCommand({
      Document: {
        S3Object: { Bucket: bucket, Name: key }
      }
    });

    const response = await textract.send(command);

    const receiptId = uuidv4();
    const now = new Date().toISOString().split("T")[0];

    const receiptData = {
      receipt_id: receiptId,
      date: now,
      vendor: "Unknown",
      total: "0.00",
      items: [],
      s3_path: `s3://${bucket}/${key}`,

    };

    const expenseDoc = response.ExpenseDocuments?.[0];

    if (expenseDoc?.SummaryFields) {
      for (const field of expenseDoc.SummaryFields) {
        const type = field.Type?.Text;
        const value = field.ValueDetection?.Text;
        if (type === "TOTAL") receiptData.total = value;
        else if (type === "INVOICE_RECEIPT_DATE") receiptData.date = value;
        else if (type === "VENDOR_NAME") receiptData.vendor = value;
      }
    }

    if (expenseDoc?.LineItemGroups) {
      for (const group of expenseDoc.LineItemGroups) {
        for (const item of group.LineItems || []) {
          const entry = {};
          for (const field of item.LineItemExpenseFields || []) {
            const type = field.Type?.Text;
            const value = field.ValueDetection?.Text;
            if (type === "ITEM") entry.name = value;
            else if (type === "PRICE") entry.price = value;
            else if (type === "QUANTITY") entry.quantity = value;
          }
          if (entry.name) receiptData.items.push(entry);
        }
      }
    }

    console.log("Extracted Receipt Data:", receiptData);
    return receiptData;
  } catch (error) {
    console.error("Textract analyze_expense failed:", error);
    throw error;
  }
}

async function storeReceiptInDynamoDB(receiptData) {
  const command = new PutCommand({
    TableName: DYNAMODB_TABLE,
    Item: {
      ...receiptData,
      processed_timestamp: new Date().toISOString(),
      items: receiptData.items.map(item => ({
        name: item.name || 'Unknown Item',
        price: item.price || '0.00',
        quantity: item.quantity || '1'
      }))
    }
  });
  await ddb.send(command);
  console.log(`Receipt stored in DynamoDB: ${receiptData.receipt_id}`);
}

async function sendEmailNotification(receiptData) {
  try {
    const itemsHtml = receiptData.items.map(item =>
      `<li>${item.name} - $${item.price} x ${item.quantity || 1}</li>`
    ).join('') || '<li>No items detected</li>';

    const htmlBody = `
      <html>
        <body>
          <h2>Receipt Processed</h2>
          <p><strong>Receipt ID:</strong> ${receiptData.receipt_id}</p>
          <p><strong>Vendor:</strong> ${receiptData.vendor}</p>
          <p><strong>Date:</strong> ${receiptData.date}</p>
          <p><strong>Total:</strong> $${receiptData.total}</p>
          <p><strong>S3 Location:</strong> ${receiptData.s3_path}</p>
          <h3>Items:</h3>
          <ul>${itemsHtml}</ul>
        </body>
      </html>
    `;

    const command = new SendEmailCommand({
      Source: SES_SENDER_EMAIL,
      Destination: { ToAddresses: [SES_RECIPIENT_EMAIL] },
      Message: {
        Subject: { Data: `Receipt Processed: ${receiptData.vendor} - $${receiptData.total}` },
        Body: {
          Html: { Data: htmlBody }
        }
      }
    });

    await ses.send(command);
    console.log(`Email sent to ${SES_RECIPIENT_EMAIL}`);
  } catch (error) {
    console.error("Failed to send SES email:", error);
  }
}