import { fetchProfileByUsername } from "./src/lib/instagram.server";
fetchProfileByUsername("instagram").then(p => {
  console.log(JSON.stringify({bio: p.biography, fullName: p.fullName, followers: p.followers}, null, 2));
}).catch(e => console.error("ERR", e));
