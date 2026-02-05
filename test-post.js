
const url = "https://ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech/sql";
console.log(`Testing POST to ${url}...`);

// Mocking a simple query body that Neon proxy expects
const body = JSON.stringify({ query: 'SELECT 1;' });

fetch(url, { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: body
})
  .then(res => {
    console.log(`Success! Status: ${res.status}`);
    return res.text();
  })
  .then(text => {
    console.log("Response text start:", text.substring(0, 100));
    process.exit(0);
  })
  .catch(err => {
    console.error("Post failed:", err);
    process.exit(1);
  });
