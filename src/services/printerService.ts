/// <reference types="web-bluetooth" />
import { Capacitor } from '@capacitor/core';
import { BleClient, BleDevice } from '@capacitor-community/bluetooth-le';

export class PrinterService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  
  // Native state
  private nativeDeviceId: string | null = null;
  private nativeServiceId: string | null = null;
  private nativeCharacteristicId: string | null = null;

  async connect(): Promise<string> {
    try {
      if (Capacitor.isNativePlatform()) {
        return await this.connectNative();
      } else {
        return await this.connectWeb();
      }
    } catch (error) {
      console.error("Bluetooth connection error:", error);
      throw error;
    }
  }

  private async connectNative(): Promise<string> {
    await BleClient.initialize();
    
    // Request device
    const device = await BleClient.requestDevice({
      // We accept all devices for now, as thermal printers often don't advertise specific services
    });
    
    this.nativeDeviceId = device.deviceId;
    await BleClient.connect(device.deviceId);
    
    // Discover services to find the writable characteristic
    const services = await BleClient.getServices(device.deviceId);
    
    for (const service of services) {
      for (const char of service.characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          this.nativeServiceId = service.uuid;
          this.nativeCharacteristicId = char.uuid;
          break;
        }
      }
      if (this.nativeCharacteristicId) break;
    }

    if (!this.nativeCharacteristicId || !this.nativeServiceId) {
      await BleClient.disconnect(device.deviceId);
      throw new Error("No writable characteristic found. This might not be a supported printer.");
    }

    return device.name || "Unknown Printer";
  }

  private async connectWeb(): Promise<string> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth API is not available in this browser. Please use Chrome or Edge.");
    }

    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Printer Service
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Alternative Printer Service
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'  // Serial Port Profile
      ]
    });
    
    this.server = await this.device.gatt?.connect() || null;
    if (!this.server) throw new Error("Could not connect to GATT server");

    const services = await this.server.getPrimaryServices();
    if (services.length === 0) throw new Error("No services found on this device");

    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          this.characteristic = char;
          break;
        }
      }
      if (this.characteristic) break;
    }

    if (!this.characteristic) {
      throw new Error("No writable characteristic found. This might not be a supported printer.");
    }
    
    return this.device.name || "Unknown Printer";
  }

  async print(data: Uint8Array): Promise<void> {
    const CHUNK_SIZE = 100;

    if (Capacitor.isNativePlatform()) {
      if (!this.nativeDeviceId || !this.nativeServiceId || !this.nativeCharacteristicId) {
        throw new Error("Printer not connected. Please pair a printer first.");
      }
      
      // Convert Uint8Array to DataView for BleClient
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        await BleClient.write(this.nativeDeviceId, this.nativeServiceId, this.nativeCharacteristicId, dataView);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } else {
      if (!this.characteristic) {
        throw new Error("Printer not connected. Please pair a printer first.");
      }
      
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await this.characteristic.writeValue(chunk);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
  }

  isConnected(): boolean {
    if (Capacitor.isNativePlatform()) {
      return this.nativeDeviceId !== null;
    }
    return this.characteristic !== null && this.device?.gatt?.connected === true;
  }
}

export const printerService = new PrinterService();
