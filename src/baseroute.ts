import express from 'express';

export abstract class RouteConifg {
  app: express.Application;
  name: string;

  constructor(app: express.Application, name: string) {
    this.app = app;
    this.name = name;
  }
  getName() {
    return this.name;
  }

  abstract configureRoutes(): express.Application;

}
