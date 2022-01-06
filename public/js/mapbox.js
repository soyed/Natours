/* eslint-disable */

export const displayMap = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiZ3JhYmJhNDUiLCJhIjoiY2t4eHVhM3B3YTVhcTMxcTNxcmgxeWF6ZCJ9.FqRQa75YHjN1goas6p_o_A';

  const map = new mapboxgl.Map({
    // the container for the map needs an element to be nested in => hence => map id created in tour pug file
    container: 'map', // container ID
    style: 'mapbox://styles/grabba45/ckxxvfz1v165w14phfkavee53', // style URL
    // allow scrolling without zooming
    scrollZoom: false,
    //   center: [-118.113491, 34.111745], // starting position [lng, lat]
    //   zoom: 10, // starting zoom
    //   // to prevent zooming
    //   interactive: false,
  });

  // Create bound => allows map to figure out how to display the location
  // Areas shown on the map
  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((location) => {
    // create a new element to store the marker
    const element = document.createElement('div');
    element.className = 'marker';

    // Creates a marker and set the exact anchor location =>
    // set the lat and lng for the location while also adding the marker to the map
    new mapboxgl.Marker({
      element,
      // means the bottom of the marker => is the precise location coordinates
      anchor: 'bottom',
    })
      .setLngLat(location.coordinates)
      .addTo(map);

    // Include a popup
    new mapboxgl.Popup({ offset: 30 })
      .setLngLat(location.coordinates)
      .setHTML(`<p>Day ${location.day}: ${location.description}</p>`)
      .addTo(map);

    // Extend the the map bounds to include the location of the current tour
    bounds.extend(location.coordinates);
  });

  // Finally => ensure the map is aware of the bounds
  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 100,
      right: 100,
    },
  });
};
