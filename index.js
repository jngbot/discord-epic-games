const cron = require('node-cron');
const axios = require('axios');

const epic_url = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=CA&allowCountries=CA"

// ENVIRONMENT
const ENVS = { test: "TEST", prod: "PROD" }
// const env = ENVS["test"]
var discord_webhook = ''
const env = ENVS["prod"]
console.log(env)
if (env == ENVS["test"]) {
  discord_webhook = process.env.TEST_DISCORD_WEBHOOK
} else if (env == ENVS["prod"]) {
  discord_webhook = process.env.PROD_DISCORD_WEBHOOK
}



// SCHEDULING
// WEEKLY
// const cron_schedule = "0 18 * * THU"
// DAILY
const cron_schedule = "5 16 * * *"
// console.log(epic_url)
// console.log(process.env.DISCORD_WEBHOOK)

// This section for running ...
const express = require("express");
const app = express()

app.get("/", (req, res) => {
  res.send("Uptime")
})

app.listen(3030)


async function check_store() {
  const res = await axios.get(epic_url);
  const res_json = JSON.stringify(res.data)
  // console.log(res_json)
  // console.log(res.data.data.Catalog.searchStore.elements)
  const games = res.data.data.Catalog.searchStore.elements
  var game_list = []
  games.forEach((game) => {
    // console.log(game.title)

    var skip = true
    const title = game.title
    const slug = game.productSlug
    const original_price = game.price.totalPrice.fmtPrice.originalPrice
    const publisher = game.seller.name
    const description = game.description
    var thumbnail = game.keyImages[0].url
    var start_date = null
    var end_date = null

    // If game is currently ON SALE
    if (game.price.lineOffers[0].appliedRules[0] != null) {
      // console.log("price", game.price.lineOffers[0].appliedRules[0].endDate)
      end_date = game.price.lineOffers[0].appliedRules[0].endDate
      skip = false
    }

    // 12 Days of Christmas it seems to be using this check
    if (game.promotions.promotionalOffers[0] != null) {
      // console.log("price", game.price.lineOffers[0].appliedRules[0].endDate)
      end_date = game.promotions.promotionalOffers[0].promotionalOffers[0].endDate
      skip = false
    }
    // Use second image so its not the default gift image from epic
    if (game.keyImages[1] != null) {
      thumbnail = game.keyImages[1].url
    }


    // console.log(game.price.totalPrice.fmtPrice.originalPrice)
    // console.log(game.seller.name)
    // console.log(game.description)

    // console.log(game.keyImages[0].url)

    // If game is projected to be ON SALE soon
    if (game.promotions != null) {
      // console.log(game.promotions.upcomingPromotionalOffers)
      if (game.promotions.upcomingPromotionalOffers[0] != null) {
        if (game.promotions.upcomingPromotionalOffers[0].promotionalOffers[0] != null) {
          // console.log(game.promotions.upcomingPromotionalOffers[0].promotionalOffers[0].startDate)
          start_date = game.promotions.upcomingPromotionalOffers[0].promotionalOffers[0].startDate
          skip = false
        }
      }
    }

    // Skip if it is 'Mystery Game'
    if (game.title == "Mystery Game") {
      skip = true
    }
    if (!skip) {
      const found_game = {
        title: title,
        url_slug: slug,
        original_price: original_price,
        publisher: publisher,
        description: description,
        thumbnail: thumbnail,
        start_date: start_date,
        end_date: end_date,
      }
      game_list.push(found_game)
      // send_discord(title, publisher, original_price, start_date, end_date, thumbnail, description)
    }

    // .upcomingPromotionalOffers.promotionalOffers
  })
  const ordered_game_list = game_list.sort(
    function(a, b) {
      return (a.end_date === null) - (b.end_date === null) || +(a > b) || -(a < b);
    })

  return ordered_game_list
}

function format_message(game) {
  const now_colour = 5174599
  const coming_soon_colour = 15844367
  const now_text = "End Date"
  const coming_soon_text = "Start Date"
  const message = [
    {
      title: `[${game.start_date == null ? "NOW" : "COMING SOON"}] ${game.title}`,
      url: `https://store.epicgames.com/en-US/p/${game.url_slug}`,
      color: `${game.start_date == null ? now_colour : coming_soon_colour}`,
      image: {
        url: game.thumbnail
      },
      fields: [
        {
          name: "Publisher",
          value: `${game.publisher}`,
        },
        {
          name: "Original Price",
          value: `${game.original_price}`,
        },
        {
          name: "Description",
          value: `${game.description}`
        },
        {
          name: `${game.start_date == null ? now_text : coming_soon_text}`,
          value: `${game.start_date == null ? game.end_date : game.start_date}`
        },
      ],
    },
  ];
  return message
}

function send_discord(game) {
  console.log("=====================================================")
  console.log(game.title)
  // console.log(game.publisher)
  // console.log(game.original_price)
  // console.log(game.start_date)
  // console.log(game.end_date)
  // console.log(game.thumbnail)
  // console.log(game.description)
  const embeds = format_message(game)
  // console.log(message)
  const data = JSON.stringify({ embeds });
  const config = {
    method: "POST",
    url: discord_webhook, // https://discord.com/webhook/url/here
    headers: { "Content-Type": "application/json" },
    data: data,
  };
  // console.log(config)
  axios(config)
  // .then((response) => {
  //   console.log("Webhook delivered successfully");
  //   return response;
  // })
  // .catch((error) => {
  //   console.log(error);
  //   return error;
  // });
}

// const fetch_games = await check_store()
// fetch_games.forEach((game) => {
//   send_discord(game)
// })

// MANUAL
// console.log('TEST: Checking Epic Games Store for Freebies :) ...');
// check_store().then(games => {
//   games.forEach((game) => {
//     send_discord(game)
//   })
// })

if (env == ENVS["test"]) {
  // FOR TESTING
  try {
    console.log('TEST: Checking Epic Games Store for Freebies :) ...');
    check_store().then(games => {
      games.forEach((game) => {
        send_discord(game)
      })
    })
  } catch (e) {
    console.log(e)
  }
}

cron.schedule(cron_schedule, () => {
  try {
    console.log('Checking Epic Games Store for Freebies :) ...');
    check_store().then(games => {
      games.forEach((game) => {
        send_discord(game)
      })
    })
  } catch (e) {
    console.log(e)
  }
});
