"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const storage_1 = require("@google-cloud/storage");
const tmp_promise_1 = require("tmp-promise");
const inputs_1 = require("./inputs");
const state_1 = require("./state");
const tar_utils_1 = require("./tar-utils");
function getBestMatch(bucket, key, restoreKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        const folderPrefix = `${github.context.repo.owner}/${github.context.repo.repo}`;
        core.debug(`Will lookup for the file ${folderPrefix}/${key}.tar`);
        const exactFile = bucket.file(`${folderPrefix}/${key}.tar`);
        const [exactFileExists] = yield exactFile.exists().catch((err) => {
            core.error('Failed to check if an exact match exists');
            throw err;
        });
        core.debug(`Exact file name: ${exactFile.name}.`);
        if (exactFileExists) {
            console.log(`🙌 Found exact match from cache for key '${key}'.`);
            return [exactFile, 'exact'];
        }
        else {
            console.log(`🔸 No exact match found for key '${key}'.`);
        }
        const bucketFiles = yield bucket
            .getFiles({
            prefix: `${folderPrefix}/${restoreKeys[restoreKeys.length - 1]}`,
        })
            .then(([files]) => files.sort((a, b) => new Date(b.metadata.updated).getTime() -
            new Date(a.metadata.updated).getTime()))
            .catch((err) => {
            core.error('Failed to list cache candidates');
            throw err;
        });
        if (core.isDebug()) {
            core.debug(`Candidates: ${JSON.stringify(bucketFiles.map((f) => ({
                name: f.name,
                metadata: {
                    updated: f.metadata.updated,
                },
            })))}.`);
        }
        for (const restoreKey of restoreKeys) {
            const foundFile = bucketFiles.find((file) => file.name.startsWith(`${folderPrefix}/${restoreKey}`));
            if (foundFile) {
                console.log(`🤝 Found match from cache for restore key '${restoreKey}'.`);
                return [foundFile, 'partial'];
            }
            else {
                console.log(`🔸 No cache candidate found for restore key '${restoreKey}'.`);
            }
        }
        return [null, 'none'];
    });
}
function main() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const inputs = (0, inputs_1.getInputs)();
        const bucket = new storage_1.Storage().bucket(inputs.bucket);
        const folderPrefix = `${github.context.repo.owner}/${github.context.repo.repo}`;
        const exactFileName = `${folderPrefix}/${inputs.key}.tar`;
        const [bestMatch, bestMatchKind] = yield core.group('🔍 Searching the best cache archive available', () => getBestMatch(bucket, inputs.key, inputs.restoreKeys));
        core.debug(`Best match kind: ${bestMatchKind}.`);
        if (!bestMatch) {
            (0, state_1.saveState)({
                bucket: inputs.bucket,
                path: inputs.path,
                cacheHitKind: 'none',
                targetFileName: exactFileName,
            });
            core.setOutput('cache-hit', 'false');
            console.log('😢 No cache candidate found.');
            return;
        }
        core.debug(`Best match name: ${bestMatch.name}.`);
        const bestMatchMetadata = yield bestMatch
            .getMetadata()
            .then(([metadata]) => metadata)
            .catch((err) => {
            core.error('Failed to read object metadatas');
            throw err;
        });
        core.debug(`Best match metadata: ${JSON.stringify(bestMatchMetadata)}.`);
        const compressionMethod = (_a = bestMatchMetadata === null || bestMatchMetadata === void 0 ? void 0 : bestMatchMetadata.metadata) === null || _a === void 0 ? void 0 : _a['Cache-Action-Compression-Method'];
        core.debug(`Best match compression method: ${compressionMethod}.`);
        if (!bestMatchMetadata || !compressionMethod) {
            (0, state_1.saveState)({
                bucket: inputs.bucket,
                path: inputs.path,
                cacheHitKind: 'none',
                targetFileName: exactFileName,
            });
            core.setOutput('cache-hit', 'false');
            console.log('😢 No cache candidate found (missing metadata).');
            return;
        }
        const workspace = (_b = process.env.GITHUB_WORKSPACE) !== null && _b !== void 0 ? _b : process.cwd();
        return (0, tmp_promise_1.withFile)((tmpFile) => __awaiter(this, void 0, void 0, function* () {
            yield core
                .group('🌐 Downloading cache archive from bucket', () => __awaiter(this, void 0, void 0, function* () {
                console.log(`🔹 Downloading file '${bestMatch.name}'...`);
                return bestMatch.download({
                    destination: tmpFile.path,
                });
            }))
                .catch((err) => {
                core.error('Failed to download the file');
                throw err;
            });
            yield core
                .group('🗜️ Extracting cache archive', () => (0, tar_utils_1.extractTar)(tmpFile.path, compressionMethod, workspace))
                .catch((err) => {
                core.error('Failed to extract the archive');
                throw err;
            });
            (0, state_1.saveState)({
                path: inputs.path,
                bucket: inputs.bucket,
                cacheHitKind: bestMatchKind,
                targetFileName: exactFileName,
            });
            core.setOutput('cache-hit', bestMatchKind === 'exact');
            console.log('✅ Successfully restored cache.');
        }));
    });
}
void main().catch((err) => {
    core.error(err);
    core.setFailed(err);
});
