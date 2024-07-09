"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configure_dotnev = configure_dotnev;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv = require('dotenv');
const envFilePath = path_1.default.resolve(process.cwd(), '.env');
const envFilePathInDist = path_1.default.resolve(process.cwd(), 'dist', '.env');
// Check if the .env file exists
function configure_dotnev() {
    if (fs_1.default.existsSync(envFilePath)) {
        console.log(`${envFilePath} exists, using that to config`);
        dotenv.config({ path: envFilePath });
    }
    else if (fs_1.default.existsSync(envFilePathInDist)) {
        console.log(`${envFilePathInDist} exists, using that to config`);
        dotenv.config({ path: envFilePathInDist });
    }
    else {
        throw Error("unable to find .env file");
    }
}
