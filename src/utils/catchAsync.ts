import { NextFunction, Request, Response } from "express";

type AsyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string>,
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<unknown>;

const catchAsync = <
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string>,
>(
  fn: AsyncHandler<P, ResBody, ReqBody, ReqQuery>,
) => {
  return (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => {
    fn(req, res, next).catch(next);
  };
};

export default catchAsync;
