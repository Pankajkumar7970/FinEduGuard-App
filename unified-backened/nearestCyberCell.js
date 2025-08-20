const axios = require("axios");

module.exports = (app) => {
  const API_KEY = process.env.GOOGLE_MAPS_KEY;

  app.get("/api/nearby-cybercells", async (req, res) => {
    const { lat, lng, radius = 100000 } = req.query;

    try {
      const response = await axios.get(
        `https://maps.gomaps.pro/maps/api/place/nearbysearch/json`,
        {
          params: {
            location: `${lat},${lng}`,
            radius,
            keyword: "cyber crime police station",
            key: API_KEY,
            type: "police",
          },
        }
      );

      let results = response.data.results;

      if (response.data.next_page_token) {
        const nextPage = await axios.get(
          `https://maps.gomaps.pro/maps/api/place/nearbysearch/json`,
          {
            params: {
              pagetoken: response.data.next_page_token,
              key: API_KEY,
            },
          }
        );
        results = [...results, ...nextPage.data.results];
      }

      const places = await Promise.all(
        results.map(async (place) => {
          const details = await axios.get(
            `https://maps.gomaps.pro/maps/api/place/details/json`,
            {
              params: {
                place_id: place.place_id,
                key: API_KEY,
                fields:
                  "name,formatted_address,formatted_phone_number,international_phone_number,website",
              },
            }
          );

          return {
            id: place.place_id,
            name: place.name,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            address: details.data.result.formatted_address,
            phone:
              details.data.result.formatted_phone_number ||
              details.data.result.international_phone_number ||
              "N/A",
            email: details.data.result.website || "N/A",
          };
        })
      );

      res.json(places);
    } catch (error) {
      console.error(error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch cyber cells" });
    }
  });
};
