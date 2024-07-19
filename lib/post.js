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
const core = __importStar(require("@actions/core"));
const glob = __importStar(require("@actions/glob"));
const storage_1 = require("@google-cloud/storage");
const path = __importStar(require("path"));
const tmp_promise_1 = require("tmp-promise");
const state_1 = require("./state");
const tar_utils_1 = require("./tar-utils");
function main() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const state = (0, state_1.getState)();
        if (state.cacheHitKind === 'exact') {
            console.log('🌀 Skipping uploading cache as the cache was hit by exact match.');
            return;
        }
        const bucket = new storage_1.Storage().bucket(state.bucket);
        const targetFileName = state.targetFileName;
        const [targetFileExists] = yield bucket
            .file(targetFileName)
            .exists()
            .catch((err) => {
            core.error('Failed to check if the file already exists');
            throw err;
        });
        core.debug(`Target file name: ${targetFileName}.`);
        if (targetFileExists) {
            console.log('🌀 Skipping uploading cache as it already exists (probably due to another job).');
            return;
        }
        const workspace = (_a = process.env.GITHUB_WORKSPACE) !== null && _a !== void 0 ? _a : process.cwd();
        const globber = yield glob.create(state.path, {
            implicitDescendants: false,
        });
        const paths = yield globber
            .glob()
            .then((files) => files.map((file) => path.relative(workspace, file)));
        core.debug(`Paths: ${JSON.stringify(paths)}.`);
        return (0, tmp_promise_1.withFile)((tmpFile) => __awaiter(this, void 0, void 0, function* () {
            const compressionMethod = yield core
                .group('🗜️ Creating cache archive', () => (0, tar_utils_1.createTar)(tmpFile.path, paths, workspace))
                .catch((err) => {
                core.error('Failed to create the archive');
                throw err;
            });
            const customMetadata = {
                'Cache-Action-Compression-Method': compressionMethod,
            };
            core.debug(`Metadata: ${JSON.stringify(customMetadata)}.`);
            yield core
                .group('🌐 Uploading cache archive to bucket', () => __awaiter(this, void 0, void 0, function* () {
                console.log(`🔹 Uploading file '${targetFileName}'...`);
                yield bucket.upload(tmpFile.path, {
                    destination: targetFileName,
                    metadata: {
                        metadata: customMetadata,
                    },
                });
            }))
                .catch((err) => {
                core.error('Failed to upload the file');
                throw err;
            });
            console.log('✅ Successfully saved cache.');
        }));
    });
}
void main().catch((err) => {
    core.error(err);
    core.setFailed(err);
});
