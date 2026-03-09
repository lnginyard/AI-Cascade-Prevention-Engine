"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const signature_detector_1 = require("./signature_detector");
describe('signature_detector', () => {
    it('detects error propagation signature from correlated anomalies', () => {
        const now = Date.now();
        const signature = (0, signature_detector_1.detectCascadeSignature)([
            {
                serviceId: 'svc-a',
                type: 'error_rate',
                observedAt: now,
                deviationStdDev: 3.2,
            },
            {
                serviceId: 'svc-b',
                dependencyServiceId: 'svc-a',
                type: 'error_rate',
                observedAt: now + 10000,
                deviationStdDev: 4.1,
            }
        ]);
        expect(signature).not.toBeNull();
        expect(signature?.signatureType).toBe('error_propagation');
        expect(signature?.affectedServices).toEqual(expect.arrayContaining(['svc-a', 'svc-b']));
    });
    it('returns null when anomalies do not meet thresholds', () => {
        const now = Date.now();
        const signature = (0, signature_detector_1.detectCascadeSignature)([
            {
                serviceId: 'svc-a',
                type: 'error_rate',
                observedAt: now,
                deviationStdDev: 1.5,
            }
        ]);
        expect(signature).toBeNull();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lnbmF0dXJlX2RldGVjdG9yLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZGV0ZWN0aW9uL3NpZ25hdHVyZV9kZXRlY3Rvci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkRBQThEO0FBRTlELFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7SUFDbEMsRUFBRSxDQUFDLCtEQUErRCxFQUFFLEdBQUcsRUFBRTtRQUN2RSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDdkIsTUFBTSxTQUFTLEdBQUcsSUFBQSwyQ0FBc0IsRUFBQztZQUN2QztnQkFDRSxTQUFTLEVBQUUsT0FBTztnQkFDbEIsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLFVBQVUsRUFBRSxHQUFHO2dCQUNmLGVBQWUsRUFBRSxHQUFHO2FBQ3JCO1lBQ0Q7Z0JBQ0UsU0FBUyxFQUFFLE9BQU87Z0JBQ2xCLG1CQUFtQixFQUFFLE9BQU87Z0JBQzVCLElBQUksRUFBRSxZQUFZO2dCQUNsQixVQUFVLEVBQUUsR0FBRyxHQUFHLEtBQU07Z0JBQ3hCLGVBQWUsRUFBRSxHQUFHO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNqQyxNQUFNLENBQUMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQzNELE1BQU0sQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUYsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsb0RBQW9ELEVBQUUsR0FBRyxFQUFFO1FBQzVELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN2QixNQUFNLFNBQVMsR0FBRyxJQUFBLDJDQUFzQixFQUFDO1lBQ3ZDO2dCQUNFLFNBQVMsRUFBRSxPQUFPO2dCQUNsQixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsVUFBVSxFQUFFLEdBQUc7Z0JBQ2YsZUFBZSxFQUFFLEdBQUc7YUFDckI7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDL0IsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRldGVjdENhc2NhZGVTaWduYXR1cmUgfSBmcm9tICcuL3NpZ25hdHVyZV9kZXRlY3Rvcic7XG5cbmRlc2NyaWJlKCdzaWduYXR1cmVfZGV0ZWN0b3InLCAoKSA9PiB7XG4gIGl0KCdkZXRlY3RzIGVycm9yIHByb3BhZ2F0aW9uIHNpZ25hdHVyZSBmcm9tIGNvcnJlbGF0ZWQgYW5vbWFsaWVzJywgKCkgPT4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgY29uc3Qgc2lnbmF0dXJlID0gZGV0ZWN0Q2FzY2FkZVNpZ25hdHVyZShbXG4gICAgICB7XG4gICAgICAgIHNlcnZpY2VJZDogJ3N2Yy1hJyxcbiAgICAgICAgdHlwZTogJ2Vycm9yX3JhdGUnLFxuICAgICAgICBvYnNlcnZlZEF0OiBub3csXG4gICAgICAgIGRldmlhdGlvblN0ZERldjogMy4yLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgc2VydmljZUlkOiAnc3ZjLWInLFxuICAgICAgICBkZXBlbmRlbmN5U2VydmljZUlkOiAnc3ZjLWEnLFxuICAgICAgICB0eXBlOiAnZXJyb3JfcmF0ZScsXG4gICAgICAgIG9ic2VydmVkQXQ6IG5vdyArIDEwXzAwMCxcbiAgICAgICAgZGV2aWF0aW9uU3RkRGV2OiA0LjEsXG4gICAgICB9XG4gICAgXSk7XG5cbiAgICBleHBlY3Qoc2lnbmF0dXJlKS5ub3QudG9CZU51bGwoKTtcbiAgICBleHBlY3Qoc2lnbmF0dXJlPy5zaWduYXR1cmVUeXBlKS50b0JlKCdlcnJvcl9wcm9wYWdhdGlvbicpO1xuICAgIGV4cGVjdChzaWduYXR1cmU/LmFmZmVjdGVkU2VydmljZXMpLnRvRXF1YWwoZXhwZWN0LmFycmF5Q29udGFpbmluZyhbJ3N2Yy1hJywgJ3N2Yy1iJ10pKTtcbiAgfSk7XG5cbiAgaXQoJ3JldHVybnMgbnVsbCB3aGVuIGFub21hbGllcyBkbyBub3QgbWVldCB0aHJlc2hvbGRzJywgKCkgPT4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgY29uc3Qgc2lnbmF0dXJlID0gZGV0ZWN0Q2FzY2FkZVNpZ25hdHVyZShbXG4gICAgICB7XG4gICAgICAgIHNlcnZpY2VJZDogJ3N2Yy1hJyxcbiAgICAgICAgdHlwZTogJ2Vycm9yX3JhdGUnLFxuICAgICAgICBvYnNlcnZlZEF0OiBub3csXG4gICAgICAgIGRldmlhdGlvblN0ZERldjogMS41LFxuICAgICAgfVxuICAgIF0pO1xuXG4gICAgZXhwZWN0KHNpZ25hdHVyZSkudG9CZU51bGwoKTtcbiAgfSk7XG59KTtcbiJdfQ==