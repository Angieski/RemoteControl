const WebSocket = require('ws');

console.log('🧪 TESTE DO SERVIDOR AWS ATUALIZADO');
console.log('====================================');

const SERVER_URL = 'ws://54.232.138.198:8080';
let testsPassed = 0;
let totalTests = 0;

function runTest(testName, testFunction) {
    totalTests++;
    console.log(`\n${totalTests}️⃣ ${testName}`);
    return testFunction()
        .then(() => {
            testsPassed++;
            console.log(`✅ ${testName} - PASSOU`);
        })
        .catch(error => {
            console.log(`❌ ${testName} - FALHOU: ${error.message}`);
        });
}

async function testServerConnection() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(SERVER_URL);
        
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout na conexão'));
        }, 5000);
        
        ws.on('open', () => {
            clearTimeout(timeout);
            console.log('   Conectado ao servidor AWS');
            ws.close();
            resolve();
        });
        
        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

async function testServerHello() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(SERVER_URL);
        
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout aguardando server_hello'));
        }, 5000);
        
        ws.on('open', () => {
            console.log('   Aguardando server_hello...');
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                if (message.type === 'server_hello') {
                    clearTimeout(timeout);
                    console.log(`   Recebido: ${message.message}`);
                    ws.close();
                    resolve();
                } else {
                    reject(new Error(`Esperado server_hello, recebido ${message.type}`));
                }
            } catch (error) {
                reject(new Error('Mensagem não é JSON válido'));
            }
        });
        
        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

async function testClientRegistration() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(SERVER_URL);
        
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout no registro de cliente'));
        }, 5000);
        
        let helloReceived = false;
        
        ws.on('open', () => {
            console.log('   Registrando cliente...');
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                
                if (message.type === 'server_hello' && !helloReceived) {
                    helloReceived = true;
                    // Enviar registro após receber hello
                    ws.send(JSON.stringify({
                        type: 'register_client',
                        clientType: 'host',
                        deviceInfo: {
                            os: 'test',
                            userAgent: 'test-aws-updated'
                        }
                    }));
                } else if (message.type === 'client_registered') {
                    clearTimeout(timeout);
                    console.log(`   Cliente registrado com ID: ${message.clientId}`);
                    ws.close();
                    resolve();
                }
            } catch (error) {
                reject(new Error('Erro ao processar mensagem'));
            }
        });
        
        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

async function testPingPong() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(SERVER_URL);
        
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout no teste ping'));
        }, 8000);
        
        let registered = false;
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                
                if (message.type === 'server_hello' && !registered) {
                    ws.send(JSON.stringify({
                        type: 'register_client',
                        clientType: 'host',
                        deviceInfo: { os: 'test' }
                    }));
                } else if (message.type === 'client_registered' && !registered) {
                    registered = true;
                    console.log('   Enviando ping...');
                    ws.send(JSON.stringify({
                        type: 'test_ping',
                        timestamp: Date.now()
                    }));
                } else if (message.type === 'test_pong') {
                    clearTimeout(timeout);
                    console.log('   Pong recebido!');
                    ws.close();
                    resolve();
                }
            } catch (error) {
                reject(new Error('Erro ao processar mensagem'));
            }
        });
        
        ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

async function testHealthAPI() {
    const response = await fetch('http://54.232.138.198:8080/health');
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    console.log(`   Health: ${data.status}, Clientes: ${data.clients}`);
    if (data.status !== 'ok') {
        throw new Error('Status não é OK');
    }
}

async function runAllTests() {
    console.log(`🔗 Testando servidor: ${SERVER_URL}`);
    
    await runTest('Conexão WebSocket', testServerConnection);
    await runTest('Server Hello', testServerHello);
    await runTest('Registro de Cliente', testClientRegistration);
    await runTest('Ping/Pong', testPingPong);
    await runTest('API Health', testHealthAPI);
    
    console.log('\n📊 RESULTADOS FINAIS:');
    console.log('===================');
    console.log(`✅ Testes aprovados: ${testsPassed}/${totalTests}`);
    console.log(`📈 Taxa de sucesso: ${(testsPassed/totalTests*100).toFixed(1)}%`);
    
    if (testsPassed === totalTests) {
        console.log('\n🎉 SERVIDOR AWS ESTÁ FUNCIONANDO PERFEITAMENTE!');
        console.log('✅ Todos os testes passaram');
        console.log('✅ WebSocket funcionando');
        console.log('✅ Protocolo atualizado');
        console.log('✅ Pronto para usar na aplicação');
    } else {
        console.log('\n⚠️ ALGUNS TESTES FALHARAM');
        console.log('🔍 Verifique se o servidor foi atualizado corretamente');
        console.log('🔄 Execute os comandos de atualização novamente se necessário');
    }
}

// Executar testes
runAllTests().catch(error => {
    console.error('\n❌ Erro geral nos testes:', error);
    process.exit(1);
});