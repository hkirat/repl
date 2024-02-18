import { S3 } from "aws-sdk"
import fs from "fs";
import path from "path";

const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT
})
export const fetchS3Folder = async (key: string, localPath: string): Promise<void> => {
    const params = {
        Bucket: process.env.S3_BUCKET ?? "",
        Prefix: key
    }

    const response = await s3.listObjectsV2(params).promise()
    // Bounty $25 to make this function run parallelly
    if (response.Contents) {
        for (const file of response.Contents) {
            const fileKey = file.Key
            if (fileKey) {
                const params = {
                    Bucket: process.env.S3_BUCKET ?? "",
                    Key: fileKey
                }
                const data = await s3.getObject(params).promise()
                if (data.Body) {
                    const fileData = data.Body
                    const filePath = `${localPath}/${fileKey.replace(key, "")}`
                    //@ts-ignore
                    await writeFile(filePath, fileData)
                }
            }
        }
    }
}

export async function copyS3Folder(sourcePrefix: string, destinationPrefix: string, continuationToken?: string): Promise<void> {
    try {
        const listParams = {
            Bucket: process.env.S3_BUCKET ?? "",
            Prefix: sourcePrefix,
            ContinuationToken: continuationToken
        };

        const listedObjects = await s3.listObjectsV2(listParams).promise();

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

        const getPromises: Promise<any>[] = [];

        for (const object of listedObjects.Contents) {
            if (!object.Key) continue;
            let destinationKey = object.Key.replace(sourcePrefix, destinationPrefix);
            let getParams = {
                Bucket: process.env.S3_BUCKET ?? "",
                CopySource: `${process.env.S3_BUCKET}/${object.Key}`,
                Key: destinationKey
            };
            console.log(getParams)

            getPromises.push(s3.copyObject(getParams).promise().then(() => {
                console.log(`Copied ${object.Key} to ${destinationKey}`);
            }));
        }

        await Promise.all(getPromises);

        if (listedObjects.IsTruncated) {
            listParams.ContinuationToken = listedObjects.NextContinuationToken;
            await getS3Folder(sourcePrefix, destinationPrefix, continuationToken);
        }
    } catch (error) {
        console.error('Error occured while copying the folder:', error);
    }
}

function writeFile(filePath: string, fileData: Buffer): Promise<void> {
    return new Promise(async (resolve, reject) => {
        await createFolder(path.dirname(filePath));

        fs.writeFile(filePath, fileData, (err) => {
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        })
    });
}

function createFolder(dirName: string) {
    return new Promise<void>((resolve, reject) => {
        fs.mkdir(dirName, { recursive: true }, (err) => {
            if (err) {
                return reject(err)
            }
            resolve()
        });
    })
}

export const saveToS3 = async (key: string, filePath: string, content: string): Promise<void> => {
    const params = {
        Bucket: process.env.S3_BUCKET ?? "",
        Key: `${key}${filePath}`,
        Body: content
    }

    await s3.putObject(params).promise()
}
