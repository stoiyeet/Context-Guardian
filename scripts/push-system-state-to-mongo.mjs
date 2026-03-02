#!/usr/bin/env node

import 'dotenv/config';

import { promises as fs } from "node:fs";
import path from "node:path";
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "context_guardian";

const synthPath =
    process.env.SYNTH_FILE ?? path.join(process.cwd(), "data", "synthesizedKnowledge.json");
const embeddingPath =
    process.env.EMBEDDINGS_FILE ?? path.join(process.cwd(), "data", "knowledgeEmbeddings.json");

const SYNTH_KEY = "synthesized-knowledge-state-v1";
const EMBEDDINGS_KEY = "knowledge-embeddings-cache-v1";
const COLLECTION = "system_state";

async function readJsonFile(filePath) {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function main() {
    if (!uri) {
        console.error("Missing MONGODB_URI in environment.");
        process.exit(1);
    }

    const [synth, embeddings] = await Promise.all([
        readJsonFile(synthPath),
        readJsonFile(embeddingPath),
    ]);

    if (!synth && !embeddings) {
        console.error("No local state files found to push.");
        console.error(`Checked: ${synthPath}`);
        console.error(`Checked: ${embeddingPath}`);
        process.exit(1);
    }

    const client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
    });

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(COLLECTION);
        const now = new Date().toISOString();

        if (synth) {
            await collection.updateOne(
                { _id: SYNTH_KEY },
                {
                    $set: {
                        payload: synth,
                        updatedAt: now,
                    },
                },
                { upsert: true },
            );
            console.log(
                `[push-system-state] upserted ${SYNTH_KEY} (patterns=${Array.isArray(synth.patterns) ? synth.patterns.length : 0})`,
            );
        }

        if (embeddings) {
            await collection.updateOne(
                { _id: EMBEDDINGS_KEY },
                {
                    $set: {
                        payload: embeddings,
                        updatedAt: now,
                    },
                },
                { upsert: true },
            );
            console.log(
                `[push-system-state] upserted ${EMBEDDINGS_KEY} (rows=${Array.isArray(embeddings.rows) ? embeddings.rows.length : 0})`,
            );
        }

        console.log(`[push-system-state] done (db=${dbName}, collection=${COLLECTION}).`);
    } catch (error) {
        console.error("[push-system-state] failed:", error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

void main();
