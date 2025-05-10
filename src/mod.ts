import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { FileSystemSync } from "@spt/utils/FileSystemSync";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import path from "path";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";


class TransitTweaker implements IPostDBLoadMod {
    private config: any;
    private logger: ILogger;
    private databaseServer: DatabaseServer;
    private fileSystem: FileSystemSync;
    private jsonUtil: JsonUtil;
    private db: IDatabaseTables;

    public postDBLoad(container: DependencyContainer): void {
        this.logger = container.resolve<ILogger>("WinstonLogger");
        this.fileSystem = container.resolve<FileSystemSync>("FileSystemSync");
        this.jsonUtil = container.resolve<JsonUtil>("JsonUtil");
        this.databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        this.db = this.databaseServer.getTables();

        this.config = this.jsonUtil.deserializeJson5(this.fileSystem.read(path.join(__dirname , "../config/config.json5")));

        // Globals config
        const transitConfig = this.db.globals.config.TransitSettings;
        const fenceConfig   = this.db.globals.config.FenceSettings;

        // There has to be a better way, no?
        const locations     = [this.db.locations.bigmap, this.db.locations.develop, this.db.locations.factory4_day, this.db.locations.factory4_night, this.db.locations.interchange, this.db.locations.laboratory, this.db.locations.lighthouse, this.db.locations.privatearea, this.db.locations.rezervbase, this.db.locations.shoreline, this.db.locations.suburbs, this.db.locations.tarkovstreets, this.db.locations.terminal, this.db.locations.town, this.db.locations.woods];

        //#region Cost
        const oldCostBear = transitConfig.BearPriceMod;
        const oldCostUsec = transitConfig.UsecPriceMod;

        transitConfig.BearPriceMod *= this.config.transitCostMultiplier;
        transitConfig.UsecPriceMod *= this.config.transitCostMultiplier;

        this.debugLog(`Changed Bear price from ${oldCostBear} to ${transitConfig.BearPriceMod}`);
        this.debugLog(`Changed Usec price from ${oldCostUsec} to ${transitConfig.UsecPriceMod}`);
        //#endregion

        //#region Grid size
        for (const [, fenceLevel ] of Object.entries(fenceConfig.Levels)) {
            const oldSize = fenceLevel.TransitGridSize;
            const newSize = this.config.transitGridSize;

            fenceLevel.TransitGridSize = newSize;
            fenceLevel.TransitGridSize.z = 0;

            this.debugLog(`Changed grid size from ${oldSize.x}x${oldSize.y} to ${fenceLevel.TransitGridSize.x}x${fenceLevel.TransitGridSize.y}`);
        }
        //#endregion

        //#region Transit time
        for (const location of locations) {
            const transits = location.base.transits;

            // Check if location has transits
            if (!transits) {
                this.debugLog(`${location.base.Name} has no transits. Skipping...`);
                continue;
            }

            for (const transit of transits) {
                const oldTime = transit.time;
                transit.time = Math.max(Math.round(transit.time * this.config.transitTimeMultiplier), 1);

                this.debugLog(`${location.base.Name} - ${transit.name}: ${oldTime} -> ${transit.time}`);
            }
        }
        //#endregion
        
        this.logger.info("[TransitTweaker] loaded.");
    }

    private debugLog(message: string) {
        if (this.config.debug) {
            this.logger.logWithColor(`[TransitTweaker] ${message}`, LogTextColor.CYAN);
        }
    }
}


module.exports = { mod: new TransitTweaker() };
