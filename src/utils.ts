export const IS_PRODUCTION = false;

export function handleError(logger: nkruntime.Logger, context: string, error: any): never {
  const errorMessage = error?.message || String(error);

  logger.error(`Error in ${context}: ${errorMessage}`);

  if (IS_PRODUCTION) {
    throw new Error('Internal Server Error');
  }

  throw new Error(errorMessage);
}
