const { GENERATOR } = require("./constants");

const dungeonScriptPath = path.join(
  __dirname,
  `../../Mythical_Maps/dungeon/rd_dungeon_args.py`
);
const roadScriptPath = path.join(
  __dirname,
  `../../Mythical_Maps/road/rd_road_args.py`
);
const tavernScriptPath = path.join(
  __dirname,
  `../../Mythical_Maps/tavern/rd_tavern_args.py`
);
const wildernessScriptPath = path.join(
  __dirname,
  `../../Mythical_Maps/wilderness/rd_wilderness_args.py`
);

const getWildernessMapSize = (mapSize) => {
  switch (mapSize) {
    case 1:
      return "small";
    case 2:
      return "medium";
    case 3:
      return "large";
    default:
      return "small";
  }
};

export const azDateTime = () => {
  const now = new Date();
  const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const arizonaTime = new Date(utcNow.getTime() - 7 * 60 * 60000); // UTC-7 for Arizona time
  return arizonaTime;
};

export const getScriptPathFromGenerator = (generator) => {
  switch (generator) {
    case GENERATOR.DUNGEON:
      return dungeonScriptPath;
    case GENERATOR.ROAD:
      return roadScriptPath;
    case GENERATOR.TAVERN:
      return tavernScriptPath;
    case GENERATOR.WILDERNESS:
      return wildernessScriptPath;
    default:
      return dungeonScriptPath;
  }
};

export const getParams = (request) => {
  const {
    generator,
    name,
    visuals,
    gridType,
    time,
    season,
    roadEvent,
    includeTavern,
    mapSize,
    quality,
    seed,
    dmGuideSettings,
  } = request;

  //   visuals: {
  //     type: null,
  //     style: null,
  //     variation: null,
  //   },
  //   seed: {
  //     show: false,
  //     value: "",
  //   },
  //   dmGuideSettings: {
  //     show: false,
  //     partyLevel: 3,
  //     partySize: 4,

  let params = {};

  switch (generator) {
    case GENERATOR.DUNGEON:
      params = {
        "--tileTheme": visuals?.type,
        "--tileCount": mapSize,
        // '--tileGenInput': 'random', // * Layout from WP prototype
        "--grid_type": gridType,
        "--party_members": dmGuideSettings?.show
          ? dmGuideSettings.partySize
          : null,
        "--party_level": dmGuideSettings?.show
          ? dmGuideSettings?.partyLevel
          : null,
        "--user_seed": seed?.show ? seed.value : null,
        "--dm_map": dmGuideSettings?.show,
        "--guide_html": dmGuideSettings?.show,
      };
      break;

    case GENERATOR.ROAD:
      params = {
        "--length": mapSize,
        "--tavern": includeTavern,
        "--time_of_day": time,
        "--season": season,
        "--grid_type": gridType,
        "--middle_event": roadEvent,
        "--quality": quality,
        "--title": name,
        "--user_seed": seed?.show ? seed.value : null,
      };
      break;

    case GENERATOR.TAVERN:
      params = {
        "--time_of_day": time,
        "--season": season,
        "--grid_type": gridType,
        "--quality": quality,
        "--title": name,
        "--user_seed": seed?.show ? seed.value : null,
      };
      break;

    case GENERATOR.WILDERNESS:
      params = {
        "--grid_type": gridType,
        "--quality": quality,
        "--title": name,
        "--size": getWildernessMapSize(mapSize),
        "--user_seed": seed?.show ? seed.value : null,
      };
      break;

    default:
      return "";
  }

  // Remove null, undefined, or false values from params
  Object.keys(params).forEach((key) =>
    params[key] == null || params[key] === false ? delete params[key] : {}
  );

  // Convert params to string
  const paramString = Object.entries(params)
    .map(([key, value]) => (value === true ? key : `${key} ${value}`))
    .join(" ");

  return paramString;
};
