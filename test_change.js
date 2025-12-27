const fetch = require('node-fetch');

async function testChangePassword() {
    try {
        const response = await fetch('http://localhost:3001/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'testuser',
                newPassword: 'newpassword123'
            })
        });
        const result = await response.json();
        console.log('Response:', result);
    } catch (error) {
        console.error('Error:', error);
    }
}

testChangePassword();