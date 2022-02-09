"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const batchserver_1 = __importDefault(require("./batchserver"));
dotenv_1.default.config({ path: `${process.cwd()}/.env.${process.env.NODE_ENV}` });
const PORT = process.env.PORT || 3000;
const app = new batchserver_1.default(PORT, []);
const server = app.start();
const SIGNALS = ['SIGTERM', 'SIGINT'];
SIGNALS.forEach((signal) => {
    process.on(signal, () => {
        console.warn(`${signal} received shutdown started`);
        server.close(() => {
            console.warn('Express server process terminated');
        });
    });
});
