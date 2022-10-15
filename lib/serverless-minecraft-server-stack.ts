import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class ServerlessMinecraftServerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const startServer = new lambda.Function(this, 'Start_Minecraft_Server', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset('lambda/Start_Minecraft_Server'),
      handler: 'lambda_function.lambda_handler',
      timeout: Duration.minutes(5),
      layers: [], /* TODO: add mcipi layer */
      environment: {
        API_GATEWAY_WEBSOCKET: 'https://7rlcxgf5oa.execute-api.us-west-2.amazonaws.com/production',
        CONNECTIONS_TABLE_NAME: 'Minecraft_WebSocket_Connections',
        INSTANCE_ID: 'i-51038532bec4d2196',
        RCON_PASSWORD: 'G5Q0HMMGoKj0DSwQlParFeNJ25jds8rg',
        WORLDS_TABLE_NAME: 'Minecraft_Worlds'
      },
      // TODO: define role
    });

    // TODO: setup triggers from API Gateway

  }
}
