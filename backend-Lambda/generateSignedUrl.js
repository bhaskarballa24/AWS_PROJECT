import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: 'us-east-1' });

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const fileName = body.fileName;
    const fileType = body.fileType;

    const command = new PutObjectCommand({ 
      Bucket: 'pro-receipts',
      Key: `Receipts/${fileName}`,
      ContentType: fileType
      // ⛔ Do NOT add "Expires" here
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ signedUrl }),
    };
  } catch (err) {
    console.error('Lambda error:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal Server Error', error: err.message }),
    };
  }
};
