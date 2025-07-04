import { Filter } from '../dbTypes';

export const readHelper = async (query: any, Filters: Filter[]) => {
    Filters.forEach(({ column, operator, value }) => {
        switch (operator) {
            case 'eq':
                query = query.eq(column, value);
                break;
            case 'neq':
                query = query.neq(column, value);
                break;
            case 'gt':
                query = query.gt(column, value);
                break;
            case 'gte':
                query = query.gte(column, value);
                break;
            case 'lt':
                query = query.lt(column, value);
                break;
            case 'lte':
                query = query.lte(column, value);
                break;
            case 'like':
                query = query.like(column, value);
                break;
            case 'ilike':
                query = query.ilike(column, value);
                break;
            case 'in':
                query = query.in(column, value);
                break;
            default:
                throw new Error(`Operator not supported: ${operator}`);
        }
    });

    return query;
};
