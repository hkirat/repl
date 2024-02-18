import { S3 } from "aws-sdk"
import fs from "fs";
import path from "path";

const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT
})

const getAndWriteS3ObjectToFS = async (options: {
    s3Key: string,
    localFilePath: string,
}) => {
    const { localFilePath, s3Key } = options;

    const getObjectParams = {
        Bucket: process.env.S3_BUCKET ?? "",
        Key: s3Key
    }

    const data = await s3.getObject(getObjectParams).promise()
    if (data.Body) {
        const fileData = data.Body
        // @ts-ignore
        await writeFile(localFilePath, fileData)
    }
}

export const fetchS3Folder = async (prefix: string, localPath: string): Promise<void> => {
    const params = {
        Bucket: process.env.S3_BUCKET ?? "",
        Prefix: prefix
    }

    const response = await s3.listObjectsV2(params).promise()

    if (response.Contents) {
        const s3Keys = response.Contents.map(c => c.Key).filter((key): key is string => !!key);

        const s3FileCopyPromises = s3Keys.map(async (s3Key) => {
            const localFilePath = `${localPath}/${s3Key.replace(prefix, "")}`;
            await getAndWriteS3ObjectToFS({
                s3Key: s3Key,
                localFilePath: localFilePath
            })
        }
        )

        await Promise.all(s3FileCopyPromises)
    }

}

export async function copyS3Folder(sourcePrefix: string, destinationPrefix: string, continuationToken?: string): Promise<void> {
    try {
        // List all objects in the source folder
        const listParams = {
            Bucket: process.env.S3_BUCKET ?? "",
            Prefix: sourcePrefix,
            ContinuationToken: continuationToken
        };

        const listedObjects = await s3.listObjectsV2(listParams).promise();

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

        // Copy each object to the new location
        // Bounty $25 to make this function run parallelly
        for (const object of listedObjects.Contents) {
            if (!object.Key) continue;
            let destinationKey = object.Key.replace(sourcePrefix, destinationPrefix);
            let copyParams = {
                Bucket: process.env.S3_BUCKET ?? "",
                CopySource: `${process.env.S3_BUCKET}/${object.Key}`,
                Key: destinationKey
            };
            console.log(copyParams)

            await s3.copyObject(copyParams).promise();
            console.log(`Copied ${object.Key} to ${destinationKey}`);
        }

        // Check if the list was truncated and continue copying if necessary
        if (listedObjects.IsTruncated) {
            listParams.ContinuationToken = listedObjects.NextContinuationToken;
            await copyS3Folder(sourcePrefix, destinationPrefix, continuationToken);
        }
    } catch (error) {
        console.error('Error copying folder:', error);
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