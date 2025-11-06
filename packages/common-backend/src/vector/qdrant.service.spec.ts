import { Test, TestingModule } from '@nestjs/testing';
import { QdrantService } from './qdrant.service';
import { ConfigService } from '@nestjs/config';

describe('QdrantService', () => {
  let service: QdrantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QdrantService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'QDRANT_URL':
                  return 'http://localhost:6333';
                case 'QDRANT_API_KEY':
                  return 'test-api-key';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<QdrantService>(QdrantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with config values', () => {
    // Test that the service initializes correctly
    // This is a basic test to ensure the service can be instantiated
    expect(service).toBeInstanceOf(QdrantService);
  });
});
