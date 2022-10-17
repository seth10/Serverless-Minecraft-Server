import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class ServerlessMinecraftServerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const lambdaRole = new iam.Role(this, 'MinecraftLambdaRole', {
      roleName: 'MinecraftLambdaRole',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
      inlinePolicies: {
        'Create-network-interface': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'ec2:CreateNetworkInterface',
                'ec2:DescribeNetworkInterfaces',
                'ec2:DeleteNetworkInterface'
              ],
              resources: ['*']
            })
          ]
        }),
        'Describe_EC2_Instances': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['ec2:DescribeInstances'],
              resources: ['*']
            })
          ]
        }),
        'DynamoDB=Minecraft_WebSocket_Connections': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                "dynamodb:PutItem",
                "dynamodb:DeleteItem",
                "dynamodb:Scan"
              ],
              resources: ['arn:aws:dynamodb:us-west-2:123456789012:table/Minecraft_WebSocket_Connections']
            })
          ]
        }),
        'DynamoDB=CosmosMC_Worlds': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                "dynamodb:Scan",
                'dynamodb:Query'
              ],
              resources: ['arn:aws:dynamodb:us-west-2:123456789012:table/Minecraft_Worlds']
            })
          ]
        }),
        'Execute_API_Gateway_WebSocket': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['execute-api:ManageConnections'],
              resources: ['arn:aws:execute-api:us-west-2:123456789012:7rlcxgf5oa/*/*/*']
            })
          ]
        }),
        'Start-Stop_Minecraft_EC2_Server': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                "ec2:StartInstances",
                "ec2:StopInstances"
              ],
              resources: ['arn:aws:ec2:us-west-2:123456789012:instance/i-51038532bec4d2196']
            })
          ]
        })
      }
    });

    const startServer = new lambda.Function(this, 'Start_Minecraft_Server', {
      functionName: 'Start_Minecraft_Server',
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
      role: lambdaRole
    });

    // TODO: add App client / App integration to Cognito userPool
    // TODO: try enabling Federation
    const userPool = new cognito.UserPool(this, 'userPool', {
      signInCaseSensitive: false,
      passwordPolicy: {
        requireDigits: false,
        requireLowercase: false,
        requireSymbols: false,
        requireUppercase: false
      },
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      autoVerify: { email: true }
    });

    const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'authorizer', {
      cognitoUserPools: [userPool]
    });

    // TODO: make Authorization name look nicer

    const restAPI = new apigateway.RestApi(this, 'rest-api');
    const startRoute = restAPI.root.addResource('start');
    // TODO: configure Integration Response and Method Response, and check if OPTIONS is actually necessary
    startRoute.addMethod('OPTIONS');
    const startServerIntegration = new apigateway.LambdaIntegration(startServer, {
      allowTestInvoke: false
    });
    // TODO: set up Method Response with HTTP Status: Proxy and Meodels: application/json => Empty
    startRoute.addMethod('POST', startServerIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: auth
    });
    /*
    const stopRoute = restAPI.root.addResource('stop');
    stopRoute.addMethod('OPTIONS');
    const stopServerIntegration = new apigateway.LambdaIntegration(stopServer);
    stopRoute.addMethod('POST', stopServerIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: auth
    });
    */
    
    // TODO: add WebSocket API

  }
}
