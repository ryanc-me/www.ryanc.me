{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShellNoCC {
  packages = with pkgs; [
    nodejs
    yarn
  ];

  shellHook = ''
    code .
  '';
}
