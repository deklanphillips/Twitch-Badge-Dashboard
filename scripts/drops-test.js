// Proof-of-concept: read your active Twitch Drops campaigns (which include
// badge rewards) via Twitch's web GraphQL API, the same one the Drops &
// Rewards page uses. This is step one — once we confirm it returns the badge
// campaigns with dates/requirements, we build the always-on poller around it.
//
// HOW TO GET YOUR TOKEN (quickest method for testing):
//   1. Open twitch.tv in your browser, logged in.
//   2. Open DevTools (Cmd+Option+I) → Application tab → Cookies →
//      https://www.twitch.tv → copy the value of the "auth-token" cookie.
//   3. Run:  TWITCH_OAUTH=that_value node scripts/drops-test.js
//
// Nothing is stored or sent anywhere except to Twitch's own API.

const OAUTH = process.env.TWITCH_OAUTH;
// Public web client id Twitch's own site uses for these GraphQL calls.
const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

if (!OAUTH) {
  console.error("Set TWITCH_OAUTH to your twitch.tv auth-token cookie. See header of this file.");
  process.exit(1);
}

async function gql(body) {
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-Id": CLIENT_ID,
      "Authorization": `OAuth ${OAUTH}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const DASHBOARD_QUERY = `
query ViewerDropsDashboard {
  currentUser {
    id
    login
    dropCampaigns {
      id
      name
      status
      startAt
      endAt
      detailsURL
      imageURL
      game { id displayName boxArtURL }
    }
  }
}`;

const DETAILS_QUERY = `
query DropCampaignDetails($id: ID!) {
  user: currentUser {
    dropCampaign(id: $id) {
      id
      name
      timeBasedDrops {
        id
        name
        startAt
        endAt
        requiredMinutesWatched
        benefitEdges {
          benefit { id name imageAssetURL }
        }
      }
    }
  }
}`;

async function main() {
  const dash = await gql({ operationName: "ViewerDropsDashboard", query: DASHBOARD_QUERY, variables: {} });
  const user = dash.data && dash.data.currentUser;
  if (!user) {
    console.error("No currentUser returned — token may be invalid or expired.");
    console.error(JSON.stringify(dash, null, 2).slice(0, 800));
    process.exit(1);
  }
  const campaigns = user.dropCampaigns || [];
  console.log(`Logged in as ${user.login}. Found ${campaigns.length} drop campaigns.\n`);

  for (const c of campaigns) {
    console.log(`■ ${c.name}  [${c.status}]`);
    console.log(`  Game: ${c.game && c.game.displayName}`);
    console.log(`  ${c.startAt}  →  ${c.endAt}`);
    try {
      const det = await gql({ operationName: "DropCampaignDetails", query: DETAILS_QUERY, variables: { id: c.id } });
      const drops = det.data && det.data.user && det.data.user.dropCampaign && det.data.user.dropCampaign.timeBasedDrops || [];
      for (const d of drops) {
        const benefits = (d.benefitEdges || []).map((b) => b.benefit.name).join(", ");
        const badgey = /badge/i.test(benefits) || /badge/i.test(d.name);
        console.log(`    • ${d.name} — watch ${d.requiredMinutesWatched} min → ${benefits}${badgey ? "   ⭐ BADGE" : ""}`);
      }
    } catch (e) {
      console.log(`    (couldn't load details: ${e.message})`);
    }
    console.log();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
