import { DataSource, DataSourceOptions } from 'typeorm';
import { registerAs } from '@nestjs/config';

const databaseConfig: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '3306', 10),
  username: process.env.DATABASE_USERNAME || 'root',
  password: process.env.DATABASE_PASSWORD || 'root',
  database: process.env.DATABASE_NAME || 'yt',
  entities: [__dirname + '/../database/entities/*.entity{.ts,.js}'],
  synchronize: false,
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsRun: true,
};

export default registerAs('database', (): DataSourceOptions => databaseConfig);

export const AppDataSource = new DataSource(databaseConfig);
