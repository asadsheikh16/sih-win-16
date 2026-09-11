"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const port = Number(process.env.API_PORT || 4000);
app_1.default.listen(port, () => console.log(`NIRAMAY API listening on http://localhost:${port}`));
