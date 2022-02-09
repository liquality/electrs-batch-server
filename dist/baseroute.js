"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteConifg = void 0;
class RouteConifg {
    constructor(app, name) {
        this.app = app;
        this.name = name;
    }
    getName() {
        return this.name;
    }
}
exports.RouteConifg = RouteConifg;
