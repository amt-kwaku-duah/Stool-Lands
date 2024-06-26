import { Router } from 'express';
import authRoutes from './authRouter';
import forgotRoute from './forgotRoutes';
import formRouter from './formRouter'
import transactionRoute from './transactionRouter';
import callbackRoute from './callbackRouter';
import backRoute from './backOfficeRoute';
import userRoute from './userRoutes';
import assignRoute from './assignRoute'
import chiefRouter from './chiefRoute';





const rootRouter: Router = Router();
rootRouter.use('/auth', authRoutes);
rootRouter.use('/password',forgotRoute)
rootRouter.use('/pay', transactionRoute)
rootRouter.use('/transaction', callbackRoute)
rootRouter.use('/new',formRouter)
rootRouter.use('/add',backRoute)
rootRouter.use('/all', userRoute)
rootRouter.use('/ins',assignRoute)
rootRouter.use('/status',chiefRouter)
export default rootRouter;