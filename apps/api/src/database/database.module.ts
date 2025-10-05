import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { environments } from "src/environments/environments";

@Module({
    imports: [
        MongooseModule.forRootAsync({
            useFactory: () => ({
                uri: environments.mongoUri,
            }),
        }),
    ],
    exports: [MongooseModule],
})

export class DatabaseModule {}
