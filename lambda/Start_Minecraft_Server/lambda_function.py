import os
import time
import json
import boto3
ec2 = boto3.client('ec2', region_name=os.environ['AWS_REGION'])
ddb = boto3.client('dynamodb')
apigwManagementApi = boto3.client('apigatewaymanagementapi', endpoint_url=os.environ['API_GATEWAY_WEBSOCKET'])
from mcipc.rcon import Client

def lambda_handler(event, context):
    # if not validate_permissions(event):
    #     return { 'statusCode': 401, 'body': "Sorry, you are not authorized." }
    
    body = json.loads(event.get("body", "{}"))
    requestingConnectionId = event.get("requestContext").get("connectionId") if event.get("requestContext") else None
    
    connectionData = ddb.scan(TableName=os.environ['CONNECTIONS_TABLE_NAME'], ProjectionExpression='connectionId')
    connections = [connection['connectionId']['S'] for connection in connectionData['Items']]
    
    def send_message(message):
        for connectionId in connections:
            response = apigwManagementApi.post_to_connection(ConnectionId=connectionId, Data=message)

    def end_with_message(message):
        send_message(message)
        return { 'statusCode': 200, 'body': message }

    instancesDescription = ec2.describe_instances(Filters=[{'Name': 'instance-id', 'Values': [os.environ['INSTANCE_ID']]}])
    state = instancesDescription['Reservations'][0]['Instances'][0]['State']['Name']
    
    if state == 'running':
        return end_with_message("Minecraft server is already running.")
    elif state == 'pending':
        return end_with_message("Minecraft server is currently in the middle of starting up.")
    elif state == 'stopping':
        return end_with_message("Minecraft server is currently in the middle of stopping.")
    
    send_message("Starting the EC2 instance...")
    response = ec2.start_instances(InstanceIds=[os.environ['INSTANCE_ID']])
    if (response['StartingInstances'][0]['CurrentState']['Name'] == 'pending' and response['StartingInstances'][0]['PreviousState']['Name'] == 'stopped'
            and response['StartingInstances'][0]['InstanceId'] == os.environ['INSTANCE_ID'] and response['ResponseMetadata']['HTTPStatusCode'] == 200):
        send_message("EC2 instance now starting.")
    else:
        send_message("Something went wrong while starting the EC2 instance:")
        send_message(response)
        return end_with_message("Something went wrong while telling the EC2 instance to start. Please note the time and report this to Seth.")
    
    state = response['StartingInstances'][0]['CurrentState']['Name']
    while state != 'running':
        time.sleep(1)
        state = ec2.describe_instances(Filters=[{'Name': 'instance-id', 'Values': [os.environ['INSTANCE_ID']]}])['Reservations'][0]['Instances'][0]['State']['Name']
        send_message(state)
    send_message("The EC2 instance has started.")
    
    instancesDescription = ec2.describe_instances(Filters=[{'Name': 'instance-id', 'Values': [os.environ['INSTANCE_ID']]}])
    # privateIp = instancesDescription['Reservations'][0]['Instances'][0]['PrivateIpAddress']
    publicIp = instancesDescription['Reservations'][0]['Instances'][0]['PublicIpAddress']
    
    def startupWorld(world):
        while True:
            try:
                with Client(publicIp, int(world['rcon_port'])) as client:
                    client.login(os.environ['RCON_PASSWORD'])
                    send_message(f"The {world['pretty_name']} world is running.")
                    return
            except ConnectionRefusedError:
                send_message(f"Waiting for the {world['pretty_name']} world to start...")
            time.sleep(5)
    
    worldData = ddb.query(TableName=os.environ['WORLDS_TABLE_NAME'], KeyConditions={
            'world': {
                'ComparisonOperator': 'EQ',
                'AttributeValueList': [ {'S': 'world'} ]
            }
        })
    def unwrapDynamoDBItem(item):
        def castType(valObj): # accepts something like {"N": "25565"}, returns 25565
            typeChar = list(valObj.keys())[0]
            value = valObj[typeChar]
            if typeChar == 'N':
                return int(value)
            return value
        return {attr: castType(item[attr]) for attr in item.keys()}
    # ignoring Count, ScannedCount, and ResponseMetadata, just looking at Items
    worlds = [unwrapDynamoDBItem(world) for world in worldData['Items']]
    worlds = sorted(worlds, key=lambda world: world['port'])
    
    send_message("Waiting for each world to start...")
    for world in worlds:
        startupWorld(world)
    send_message("All Minecraft worlds are running.")
        
    return end_with_message("The Minecraft server has started successfully.")

def validate_permissions(event):
    print(event)
    #event.requestContext.authorizer.claims.email
    #event.requestContext.authorizer.claims['cognito:username']
    if not event['requestContext']['authorizer']:
        return False
    print(event)
    print()
    print(event['requestContext'])
    print()
    print(event['requestContext']['authorizer'])
    username = event['requestContext']['authorizer']['claims']['cognito:username']
    return False
