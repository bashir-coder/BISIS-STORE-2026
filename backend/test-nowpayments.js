const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io';
const apiKey = process.env.NOWPAYMENTS_API_KEY;

async function test() {
  await new Promise(r => setTimeout(r, 5000));
  
  const payload = {
    price_amount: 149,
    price_currency: 'usd',
    pay_currency: 'usdcbsc',
    order_id: '117',
    order_description: 'The 30-Minute Session',
    customer_email: 'test@example.com'
  };
  
  const response = await fetch(NOWPAYMENTS_API_URL + '/v1/invoice', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(payload)
  });
  
  const text = await response.text();
  console.log('Response:', response.status, text);
}

test().catch(console.error);