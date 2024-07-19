"use strict";
/* eslint-disable sonarjs/no-duplicate-string */
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
exports.extractTar = exports.createTar = exports.CompressionMethod = void 0;
const exec = __importStar(require("@actions/exec"));
const semver = __importStar(require("semver"));
const ZSTD_WITHOUT_LONG_VERSION = '1.3.2';
var CompressionMethod;
(function (CompressionMethod) {
    CompressionMethod["GZIP"] = "gzip";
    CompressionMethod["ZSTD_WITHOUT_LONG"] = "zstd (without long)";
    CompressionMethod["ZSTD"] = "zstd";
})(CompressionMethod = exports.CompressionMethod || (exports.CompressionMethod = {}));
function getTarCompressionMethod() {
    return __awaiter(this, void 0, void 0, function* () {
        if (process.platform === 'win32') {
            return CompressionMethod.GZIP;
        }
        const [zstdOutput, zstdVersion] = yield exec
            .getExecOutput('zstd', ['--version'], {
            ignoreReturnCode: true,
            silent: true,
        })
            .then((out) => out.stdout.trim())
            .then((out) => {
            const extractedVersion = /v(\d+(?:\.\d+){0,})/.exec(out);
            return [out, extractedVersion ? extractedVersion[1] : null];
        })
            .catch(() => ['', null]);
        if (!(zstdOutput === null || zstdOutput === void 0 ? void 0 : zstdOutput.toLowerCase().includes('zstd command line interface'))) {
            return CompressionMethod.GZIP;
        }
        else if (!zstdVersion ||
            semver.lt(zstdVersion, ZSTD_WITHOUT_LONG_VERSION)) {
            return CompressionMethod.ZSTD_WITHOUT_LONG;
        }
        else {
            return CompressionMethod.ZSTD;
        }
    });
}
function createTar(archivePath, paths, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        const compressionMethod = yield getTarCompressionMethod();
        console.log(`🔹 Using '${compressionMethod}' compression method.`);
        const compressionArgs = compressionMethod === CompressionMethod.GZIP
            ? ['-z']
            : compressionMethod === CompressionMethod.ZSTD_WITHOUT_LONG
                ? ['--use-compress-program', 'zstd -T0']
                : ['--use-compress-program', 'zstd -T0 --long=30'];
        yield exec.exec('tar', [
            '-c',
            ...compressionArgs,
            '--posix',
            '-P',
            '-f',
            archivePath,
            '-C',
            cwd,
            ...paths,
        ]);
        return compressionMethod;
    });
}
exports.createTar = createTar;
function extractTar(archivePath, compressionMethod, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🔹 Detected '${compressionMethod}' compression method from object metadata.`);
        const compressionArgs = compressionMethod === CompressionMethod.GZIP
            ? ['-z']
            : compressionMethod === CompressionMethod.ZSTD_WITHOUT_LONG
                ? ['--use-compress-program', 'zstd -d']
                : ['--use-compress-program', 'zstd -d --long=30'];
        yield exec.exec('tar', [
            '-x',
            ...compressionArgs,
            '-P',
            '-f',
            archivePath,
            '-C',
            cwd,
        ]);
    });
}
exports.extractTar = extractTar;
