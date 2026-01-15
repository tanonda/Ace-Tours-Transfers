
const url = "https://ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech/";
console.log(`Fetching ${url}...`);

fetch(url, { method: 'HEAD' })
  .then(res => {
    console.log(`Success! Status: ${res.status}`);
    process.exit(0);
  })
  .catch(err => {
    console.error("Fetch failed:", err);
    process.exit(1);
  });
