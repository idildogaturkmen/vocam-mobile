type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in';

export type Filter = {
    column: string;
    operator: FilterOperator;
    value: any;
};

export type ReadInputCommandType = {
    TableName: string;
    Filters?: Filter[];
};

export type WriteInputCommandType = {
    TableName: string;
    Items: Record<string, any>[];
};
