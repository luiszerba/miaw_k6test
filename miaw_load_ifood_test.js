import http  from 'k6/http'
import { check, fail, sleep } from 'k6'
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';

const params = {
    "grant_type": "password",
    "client_secret": "",
    "client_id": "",
    "username": "",
    "password": ""
}

const ORG_ID = ""
const ES_DEVELOPER_NAME = ""

const LOGIN_URL = 'https://login.salesforce.com/services/oauth2/token'
const ENPOINT_URL = ''

const ENPOINT_ACCESS_TOKEN_UNAUTHENTICATED = `${ENPOINT_URL}/iamessage/api/v2/authorization/unauthenticated/access-token`
const ENDPOINT_CREATE_CONVERSATION = `${ENPOINT_URL}/iamessage/api/v2/conversation`

//Necessita sufixo UUID/message no endpoint
const ENDPOINT_SEND_MESSAGE = `${ENPOINT_URL}/iamessage/api/v2/conversation`

//Necessita sufixo UUID/file no endpoint
const ENDPOINT_SEND_FILE = `${ENPOINT_URL}/iamessage/api/v2/conversation`

var access_token = ''
var instance_url = ''

// var guest_access_token = ''

const NUMBER_OF_CONVERSATIONS = 1
const NUMBER_OF_MESSAGES = 1
const NUMBER_OF_FILES = 1
let uuids = []

const img = open("/Users/lcorrea/development/miaw_test/bag.jpg","b")

console.log(`File loaded: ${img !== null ? 'Yes' : 'No'}`);
console.log(`File size (bytes): ${img.byteLength}`);
console.log(`First 100 bytes of file: ${img.slice(0, 100)}`);

if (!img || img.length === 0) {
    fail('Failed to load the image or the file is empty.');
}

export default function(){
    if(!access_token){
        authenticate()
    }

    let guest_access_token = get_guest_access_token()
    if(guest_access_token){
        create_conversation(guest_access_token)
        send_message(guest_access_token)
        //send_file(guest_access_token)
        send_file_v2(guest_access_token)
    }else {
        fail('Failed to obtain guest access token.');
    }
    
    
    sleep(5)
}

function authenticate(){

    const url = LOGIN_URL

    const response = http.post(url, params)

    const authData = JSON.parse(response.body)

    access_token = authData.access_token
    instance_url = authData.instance_url

    const checkResponse = check(response, {
        'access token received' : (r) => r.status === 200 && access_token !== ''
    }); 

    if(!checkResponse){
        fail(`Error : ${JSON.stringify(response.body)}`)
    }
}

function get_guest_access_token(){

    const url = ENPOINT_ACCESS_TOKEN_UNAUTHENTICATED

    const header = {
        "Content-type": "application/json",
        "Authorization": `Bearer ${access_token}`
    }

    const params = {
        "orgId": ORG_ID,
        "esDeveloperName": ES_DEVELOPER_NAME,
        "capabilitiesVersion": '1',
        "platform": "Web",
        "context": {
            "appName": "salesApp",
            "clientVersion": "1.2.3"
        }
    }

    const payload = JSON.stringify(params)
    
    // console.log(`header = ${JSON.stringify(header)}`)
    // console.log(`params = ${JSON.stringify(params)}`)

    const response = http.post(url, payload, { headers: header })
    const authData = JSON.parse(response.body)

    const guest_access_token = authData.accessToken
    
    // console.log(`guest_access_token ${guest_access_token}`)
    const checkResponse = check(response, {
        'guest access token received': (r) => r.status === 200 && guest_access_token !== ''
    })

    if(!checkResponse){
        fail(`Error : ${JSON.stringify(response.body)}`)
    }

    return guest_access_token

}

function create_conversation(guest_access_token){

    const url = ENDPOINT_CREATE_CONVERSATION

    const header = {
        "Content-type": "application/json",
        "Authorization": `Bearer ${guest_access_token}`
    }

    for(let i=0;i<NUMBER_OF_CONVERSATIONS;i++){

        const uuid = generateUUID()
        uuids.push(uuid)

        const params = {
            "conversationId": uuid,
            "routingAttributes": { "_firstName":"Luis","_email": "zerbacorrea@gmail.com" },
            "esDeveloperName": ES_DEVELOPER_NAME
        }

        const payload = JSON.stringify(params)

        const response = http.post(url, payload, { headers: header })

        console.log(`Response.body ${response.body}`)
        
        const checkResponse = check(response, {
            'guest access token received': (r) => r.status === 201
        })

        if(!checkResponse){
            fail(`Error : ${JSON.stringify(response.body)}`)
        }
    }
}

function send_message(guest_access_token){

    const header = {
        "Content-type": "application/json",
        "Authorization": `Bearer ${guest_access_token}`
    }

    for(let i=0;i<uuids.length;i++){
        const uuid = uuids[i]

        const url = `${ENDPOINT_SEND_MESSAGE}/${uuid}/message`

        for(let j=0;j<NUMBER_OF_MESSAGES;j++){

            const params = {
                "message": {
                    "id": generateUUID(),
                    "messageType": "StaticContentMessage",
                    "staticContent": {
                    "formatType": "Text",
                    "text": gerarMensagemReclamacao()
                    }
                },
                "esDeveloperName": ES_DEVELOPER_NAME,
                "isNewMessagingSession": false,
                "language": ""
            }

            const payload = JSON.stringify(params)

            const response = http.post(url, payload, { headers: header })

            const checkResponse = check(response, {
                'guest access token received': (r) => r.status === 202
            })

            if(!checkResponse){
                // console.log(`uuid: ${uuid}`)
                // console.log(`uuid: ${guest_access_token}`)
                // console.log(`payload: ${payload}`)
                fail(`Error send_message: ${JSON.stringify(response.body)}`)
            }
        }
    }
} 

function send_file_v2(guest_access_token) {

    for (let i = 0; i < uuids.length; i++) {
        const uuid = uuids[i];
        const url = `${ENDPOINT_SEND_FILE}/${uuid}/file`;

        const fd = FormData()
        fd.append('messageEntry', {
            data: JSON.stringify({
                "message": {
                    "id": generateUUID(),
                    "fileId": generateUUID(),
                    "text": gerarMensagemReclamacao(),
                    "inReplyToMessageId": "a133c185"
                },
                "isNewMessagingSession": false,
                "esDeveloperName": ES_DEVELOPER_NAME,
            }),
            content_type: 'application/json'
        })
        fd.append('fileData', {
            data: img,
            filename: 'bag.jpg',
            content_type: 'image/png'
        })

        const response = http.post(url, fd.body(), {
            headers: { 
                'Authorization': `Bearer ${guest_access_token}`,
                'Content-type': 'multipart/form-data; boundary= ' + fd.boundary}
        })

        const checkResponse = check(response, {
            'file sent successfully': (r) => r.status === 202,
        });

        if (!checkResponse) {
            console.log(`Response Body: ${response.body}`);
            fail(`Error in send_file: ${JSON.stringify(response.body)}`);
        }
    }
}

function generateUUID(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function gerarMensagemReclamacao() {
    const mensagens = [
        "A entrega demorou muito mais do que o previsto.",
        "A comida chegou fria e mal embalada.",
        "O pedido veio errado, não recebi o que solicitei.",
        "Faltou um item no meu pedido.",
        "A embalagem estava violada quando o pedido chegou.",
        "O entregador foi rude e pouco educado.",
        "A comida chegou com um sabor estranho, parecia estragada.",
        "Meu pedido foi cancelado sem explicações.",
        "Os itens da sobremesa estavam derretidos.",
        "A entrega foi feita no endereço errado.",
        "O preço que paguei não corresponde ao valor indicado no app.",
        "Recebi um pedido de outro cliente.",
        "O tempo de espera no aplicativo era muito diferente da realidade.",
        "A porção enviada é muito menor do que a anunciada.",
        "O entregador deixou o pedido na portaria sem avisar."
    ];

    // Return a random complaint from the array
    return mensagens[Math.floor(Math.random() * mensagens.length)];
}

//17M de contatos de usuários unicos / mês
//Usuários unicos abrindo 
//420k chats simultaneos
