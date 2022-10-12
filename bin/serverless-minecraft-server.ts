#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ServerlessMinecraftServerStack } from '../lib/serverless-minecraft-server-stack';

const app = new cdk.App();
new ServerlessMinecraftServerStack(app, 'ServerlessMinecraftServerStack');
