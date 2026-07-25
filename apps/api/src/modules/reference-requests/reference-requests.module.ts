import { Module } from '@nestjs/common';

import { ImagesModule } from '../images/images.module';
import { ReferenceRequestsController } from './reference-requests.controller';
import { ReferenceRequestsService } from './reference-requests.service';

@Module({
  imports: [ImagesModule],
  controllers: [ReferenceRequestsController],
  providers: [ReferenceRequestsService],
  exports: [ReferenceRequestsService],
})
export class ReferenceRequestsModule {}
