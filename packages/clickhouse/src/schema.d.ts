export declare const getDatabaseSchema: (databaseName: string) => string;
export declare const getTablesSchema: (databaseName: string) => string;
export declare const getMaterializedViewSchema: (databaseName: string) => string;
export interface TableSchema {
    name: string;
    engine: string;
    columns: {
        name: string;
        type: string;
        description?: string;
    }[];
}
export interface HashMap {
    id: number;
    ns: number;
    path: number[];
    data: number;
    content: number;
}
//# sourceMappingURL=schema.d.ts.map